import openai
import os
import json
import numpy as np
from typing import List, Dict, Any

class RAGEngine:
    def __init__(self):
        self.embedding_model = "text-embedding-3-small"
        self.gpt_model = "gpt-4o-mini"
        self._client = None
    
    @property
    def client(self):
        """Lazy initialization of OpenAI client"""
        if self._client is None:
            self._client = self._create_openai_client()
        return self._client
    
    def _create_openai_client(self):
        """Create OpenAI client without any proxy configuration"""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("Warning: OPENAI_API_KEY not found in environment variables")
            return None
        
        try:
            # Create the simplest possible client
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            return client
        except Exception as e:
            print(f"Error creating OpenAI client: {e}")
            return None
    
    def create_embeddings(self, text: str, chunk_size: int = 1000) -> List[Dict[str, Any]]:
        """Create embeddings for text chunks"""
        if not self.client:
            print("OpenAI client not available")
            return []
            
        chunks = self._chunk_text(text, chunk_size)
        embeddings = []
        
        for i, chunk in enumerate(chunks):
            try:
                response = self.client.embeddings.create(
                    model=self.embedding_model,
                    input=chunk
                )
                
                embedding_data = {
                    "text_chunk": chunk,
                    "embedding": response.data[0].embedding,
                    "metadata": {
                        "chunk_index": i,
                        "chunk_size": len(chunk)
                    }
                }
                embeddings.append(embedding_data)
            except Exception as e:
                print(f"Error creating embedding for chunk {i}: {e}")
                continue
        
        return embeddings
    
    def search_similar(self, query: str, embeddings: List[List[float]], top_k: int = 5) -> List[int]:
        """Search for similar embeddings"""
        if not self.client:
            print("OpenAI client not available")
            return []
            
        try:
            query_embedding = self.client.embeddings.create(
                model=self.embedding_model,
                input=query
            ).data[0].embedding
            
            # Simple cosine similarity
            similarities = []
            for i, emb in enumerate(embeddings):
                sim = self._cosine_similarity(query_embedding, emb)
                similarities.append((i, sim))
            
            similarities.sort(key=lambda x: x[1], reverse=True)
            return [idx for idx, _ in similarities[:top_k]]
        except Exception as e:
            print(f"Error in similarity search: {e}")
            return []
    
    def answer_query(self, query: str, context: str) -> str:
        """Answer query based on context"""
        if not self.client:
            return "OpenAI client not available. Please check your API key."
            
        try:
            prompt = f"""Based on the following contract context, answer the query.
            
            Context:
            {context}
            
            Query: {query}
            
            Answer:"""
            
            response = self.client.chat.completions.create(
                model=self.gpt_model,
                messages=[
                    {"role": "system", "content": "You are a contract analysis assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1
            )
            
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error answering query: {e}")
            return f"Error processing query: {str(e)}"
    
    def _chunk_text(self, text: str, chunk_size: int) -> List[str]:
        """Split text into chunks"""
        words = text.split()
        chunks = []
        current_chunk = []
        current_size = 0
        
        for word in words:
            if current_size + len(word) + 1 > chunk_size:
                chunks.append(" ".join(current_chunk))
                current_chunk = [word]
                current_size = len(word)
            else:
                current_chunk.append(word)
                current_size += len(word) + 1
        
        if current_chunk:
            chunks.append(" ".join(current_chunk))
        
        return chunks
    
    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        a = np.array(a)
        b = np.array(b)
        
        # Handle zero vectors
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
            
        return np.dot(a, b) / (norm_a * norm_b)
