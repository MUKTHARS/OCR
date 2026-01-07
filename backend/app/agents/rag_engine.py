import openai
import os
import json
from typing import List, Dict, Any
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class RAGEngine:
    def __init__(self):
        self.embedding_model = "text-embedding-3-small"
        self.gpt_model = "gpt-4-turbo-preview"
    
    def create_embeddings(self, text: str, chunk_size: int = 1000) -> List[Dict[str, Any]]:
        """Create embeddings for text chunks"""
        chunks = self._chunk_text(text, chunk_size)
        embeddings = []
        
        for i, chunk in enumerate(chunks):
            response = client.embeddings.create(
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
        
        return embeddings
    
    def search_similar(self, query: str, embeddings: List[List[float]], top_k: int = 5) -> List[int]:
        """Search for similar embeddings"""
        query_embedding = client.embeddings.create(
            model=self.embedding_model,
            input=query
        ).data[0].embedding
        
        # Simple cosine similarity (for production, use vector DB)
        similarities = []
        for i, emb in enumerate(embeddings):
            sim = self._cosine_similarity(query_embedding, emb)
            similarities.append((i, sim))
        
        similarities.sort(key=lambda x: x[1], reverse=True)
        return [idx for idx, _ in similarities[:top_k]]
    
    def answer_query(self, query: str, context: str) -> str:
        """Answer query based on context"""
        prompt = f"""Based on the following contract context, answer the query.
        
        Context:
        {context}
        
        Query: {query}
        
        Answer:"""
        
        response = client.chat.completions.create(
            model=self.gpt_model,
            messages=[
                {"role": "system", "content": "You are a contract analysis assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )
        
        return response.choices[0].message.content
    
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
        import numpy as np
        a = np.array(a)
        b = np.array(b)
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))