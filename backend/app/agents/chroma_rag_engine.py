import chromadb
from chromadb.config import Settings
import os
from typing import List, Dict, Any, Optional
import json
from sentence_transformers import SentenceTransformer
import numpy as np
from datetime import datetime

class ChromaRAGEngine:
    def __init__(self, persist_directory: str = "./chroma_db"):
        """Initialize ChromaDB with persistence"""
        # Create persist directory if it doesn't exist
        os.makedirs(persist_directory, exist_ok=True)
        
        # Initialize Chroma client
        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Get or create collection
        self.collection_name = "contract_embeddings"
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        
        # Initialize sentence transformer model
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.embedding_dim = 384  # Dimension for all-MiniLM-L6-v2
        
        print(f"ChromaDB initialized with collection: {self.collection_name}")
    
    def create_embeddings(self, text: str, contract_id: int, version: int = 1) -> List[Dict[str, Any]]:
        """Create embeddings and store in ChromaDB"""
        try:
            # Clean and prepare text
            cleaned_text = self._clean_text(text)
            
            if not cleaned_text or len(cleaned_text.strip()) < 100:
                print(f"Warning: Text too short for embeddings: {len(cleaned_text)} chars")
                return []
            
            # Create chunks
            chunks = self._create_smart_chunks(cleaned_text)
            print(f"Created {len(chunks)} chunks for contract {contract_id}")
            
            # Prepare data for ChromaDB
            ids = []
            documents = []
            metadatas = []
            embeddings = []
            
            for i, chunk in enumerate(chunks):
                chunk_id = f"contract_{contract_id}_chunk_{i}_v{version}"
                
                # Create embedding
                embedding = self.embedding_model.encode(chunk).tolist()
                
                # Prepare metadata
                metadata = {
                    "contract_id": contract_id,
                    "chunk_index": i,
                    "chunk_size": len(chunk),
                    "tokens": len(chunk.split()),
                    "version": version,
                    "created_at": datetime.now().isoformat()
                }
                
                ids.append(chunk_id)
                documents.append(chunk)
                metadatas.append(metadata)
                embeddings.append(embedding)
            
            # Add to ChromaDB collection
            self.collection.add(
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas,
                documents=documents
            )
            
            print(f"Stored {len(chunks)} embeddings in ChromaDB for contract {contract_id}")
            
            # Return formatted data
            embeddings_data = []
            for i, chunk in enumerate(chunks):
                embeddings_data.append({
                    "contract_id": contract_id,
                    "text_chunk": chunk,
                    "chunk_metadata": metadatas[i],
                    "version": version,
                    "chunk_id": ids[i]
                })
            
            return embeddings_data
            
        except Exception as e:
            print(f"Error creating embeddings in ChromaDB: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def search_similar(self, query: str, contract_ids: Optional[List[int]] = None, top_k: int = 5) -> List[Dict[str, Any]]:
        """Search for similar content using ChromaDB"""
        try:
            # Create query embedding
            query_embedding = self.embedding_model.encode(query).tolist()
            
            # Build filters
            where_filter = None
            if contract_ids:
                where_filter = {"contract_id": {"$in": contract_ids}}
            
            # Query ChromaDB
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=where_filter,
                include=["metadatas", "documents", "distances"]
            )
            
            # Format results
            similarities = []
            if results['ids'][0]:  # Check if we have results
                for i, chunk_id in enumerate(results['ids'][0]):
                    similarity = results['distances'][0][i]
                    
                    # Convert distance to similarity score (cosine distance to similarity)
                    similarity_score = 1 - similarity if similarity <= 1 else 0
                    
                    similarities.append({
                        "id": chunk_id,
                        "contract_id": results['metadatas'][0][i].get("contract_id"),
                        "text_chunk": results['documents'][0][i],
                        "similarity": similarity_score,
                        "metadata": results['metadatas'][0][i]
                    })
            
            return similarities
            
        except Exception as e:
            print(f"Error in ChromaDB similarity search: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def answer_query(self, query: str, context_chunks: List[Dict], contract_info: Optional[Dict] = None) -> Dict[str, Any]:
        """Answer query based on context chunks"""
        try:
            context_text = "\n\n".join([chunk["text_chunk"] for chunk in context_chunks[:5]])
            
            if contract_info:
                contract_context = f"""
                Contract Information:
                - Type: {contract_info.get('contract_type', 'Unknown')}
                - Parties: {', '.join(contract_info.get('parties', []))}
                - Value: {contract_info.get('financial', {}).get('total_value', 'Unknown')}
                - Dates: Effective {contract_info.get('dates', {}).get('effective_date', 'Unknown')}
                """
                context_text = contract_context + "\n\n" + context_text
            
            # Use OpenAI for answering
            from openai import OpenAI
            import os
            
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                print("OpenAI API key not configured for ChromaRAGEngine")
                return {
                    "answer": "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.",
                    "confidence": 0.0,
                    "sources_used": 0
                }
            
            # Create simple client without proxy settings
            try:
                client = OpenAI(api_key=api_key)
            except Exception as client_error:
                print(f"Failed to create OpenAI client in ChromaRAGEngine: {client_error}")
                # Fallback answer
                return {
                    "answer": "AI service temporarily unavailable. Based on the extracted text, here's what we found:\n\n" + 
                            context_text[:500] + "...",
                    "confidence": 0.5,
                    "sources_used": len(context_chunks)
                }
            
            prompt = f"""Based on the following contract context, answer the query accurately.

            Context:
            {context_text[:8000]}

            Query: {query}

            Provide a detailed answer with specific references to the contract context.
            If the answer cannot be found in the context, state "Information not found in contract."
            
            Answer:"""
            
            response = client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": "You are a contract analysis assistant. Provide accurate, specific answers based only on the provided context."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            answer = response.choices[0].message.content
            
            similarities = [chunk.get("similarity", 0) for chunk in context_chunks]
            avg_similarity = sum(similarities) / len(similarities) if similarities else 0
            confidence = min(avg_similarity * 1.2, 1.0)
            
            return {
                "answer": answer,
                "confidence": confidence,
                "sources_used": len(context_chunks),
                "avg_similarity": avg_similarity
            }
            
        except Exception as e:
            print(f"Error answering query: {e}")
            import traceback
            traceback.print_exc()
            return {
                "answer": "Error processing query. Please try again.",
                "confidence": 0.0,
                "sources_used": 0,
                "error": str(e)
            }

    # def answer_query(self, query: str, context_chunks: List[Dict], contract_info: Optional[Dict] = None) -> Dict[str, Any]:
    #     """Answer query based on context chunks"""
    #     try:
    #         context_text = "\n\n".join([chunk["text_chunk"] for chunk in context_chunks[:5]])
            
    #         if contract_info:
    #             contract_context = f"""
    #             Contract Information:
    #             - Type: {contract_info.get('contract_type', 'Unknown')}
    #             - Parties: {', '.join(contract_info.get('parties', []))}
    #             - Value: {contract_info.get('financial', {}).get('total_value', 'Unknown')}
    #             - Dates: Effective {contract_info.get('dates', {}).get('effective_date', 'Unknown')}
    #             """
    #             context_text = contract_context + "\n\n" + context_text
            
    #         # Use OpenAI for answering (import at top of file)
    #         from openai import OpenAI
    #         import os
            
    #         api_key = os.getenv("OPENAI_API_KEY")
    #         if not api_key:
    #             return {
    #                 "answer": "OpenAI API key not configured",
    #                 "confidence": 0.0,
    #                 "sources_used": 0
    #             }
            
    #         client = OpenAI(api_key=api_key)
            
    #         prompt = f"""Based on the following contract context, answer the query accurately.

    #         Context:
    #         {context_text[:8000]}

    #         Query: {query}

    #         Provide a detailed answer with specific references to the contract context.
    #         If the answer cannot be found in the context, state "Information not found in contract."
            
    #         Answer:"""
            
    #         response = client.chat.completions.create(
    #             model="gpt-4-turbo-preview",
    #             messages=[
    #                 {"role": "system", "content": "You are a contract analysis assistant. Provide accurate, specific answers based only on the provided context."},
    #                 {"role": "user", "content": prompt}
    #             ],
    #             temperature=0.1,
    #             max_tokens=1000
    #         )
            
    #         answer = response.choices[0].message.content
            
    #         similarities = [chunk.get("similarity", 0) for chunk in context_chunks]
    #         avg_similarity = sum(similarities) / len(similarities) if similarities else 0
    #         confidence = min(avg_similarity * 1.2, 1.0)
            
    #         return {
    #             "answer": answer,
    #             "confidence": confidence,
    #             "sources_used": len(context_chunks),
    #             "avg_similarity": avg_similarity
    #         }
            
    #     except Exception as e:
    #         print(f"Error answering query: {e}")
    #         import traceback
    #         traceback.print_exc()
    #         return {
    #             "answer": "Error processing query.",
    #             "confidence": 0.0,
    #             "sources_used": 0,
    #             "error": str(e)
    #         }
    
    def _clean_text(self, text: str) -> str:
        """Clean text for embedding"""
        import re
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'[^\w\s.,;:()\-$%&@]', ' ', text)
        text = ' '.join(text.split())
        return text.strip()
    
    def _create_smart_chunks(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Create intelligent text chunks with overlap"""
        words = text.split()
        chunks = []
        current_chunk = []
        current_size = 0
        
        for i, word in enumerate(words):
            word_size = len(word) + 1
            
            if current_size + word_size > chunk_size:
                chunks.append(" ".join(current_chunk))
                
                # Start new chunk with overlap
                overlap_words = current_chunk[-overlap//5:] if len(current_chunk) > overlap//5 else current_chunk
                current_chunk = overlap_words + [word]
                current_size = sum(len(w) + 1 for w in current_chunk)
            else:
                current_chunk.append(word)
                current_size += word_size
        
        if current_chunk:
            chunks.append(" ".join(current_chunk))
        
        return chunks
    
    def delete_contract_embeddings(self, contract_id: int):
        """Delete all embeddings for a specific contract"""
        try:
            # Get all chunk IDs for this contract
            results = self.collection.get(
                where={"contract_id": contract_id},
                include=["metadatas"]
            )
            
            if results['ids']:
                self.collection.delete(ids=results['ids'])
                print(f"Deleted {len(results['ids'])} embeddings for contract {contract_id}")
            
        except Exception as e:
            print(f"Error deleting contract embeddings: {e}")
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about the ChromaDB collection"""
        try:
            count = self.collection.count()
            
            # Sample some documents to get average length
            sample = self.collection.get(limit=min(10, count))
            avg_length = 0
            if sample['documents']:
                avg_length = sum(len(doc) for doc in sample['documents']) / len(sample['documents'])
            
            return {
                "total_documents": count,
                "collection_name": self.collection_name,
                "embedding_dimension": self.embedding_dim,
                "average_document_length": avg_length
            }
        except Exception as e:
            print(f"Error getting collection stats: {e}")
            return {"error": str(e)}
