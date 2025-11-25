"""
Feature module with industry-standard patterns
"""
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from datetime import datetime
import logging
import asyncio
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


@dataclass
class FeatureConfig:
    """Configuration for feature processing"""
    max_retries: int = 3
    timeout: int = 30
    cache_enabled: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)


class ProcessorInterface(ABC):
    """Abstract base class for processors"""
    
    @abstractmethod
    async def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process input data"""
        pass
    
    @abstractmethod
    def validate(self, data: Dict[str, Any]) -> bool:
        """Validate input data"""
        pass


class FeatureProcessor(ProcessorInterface):
    """Main feature processor with async support"""
    
    def __init__(self, config: Optional[FeatureConfig] = None):
        self.config = config or FeatureConfig()
        self._cache: Dict[str, Any] = {}
        self._metrics = {
            'processed': 0,
            'failed': 0,
            'cache_hits': 0
        }
    
    def validate(self, data: Dict[str, Any]) -> bool:
        """Validate input data structure"""
        required_fields = ['id', 'timestamp', 'payload']
        return all(field in data for field in required_fields)
    
    async def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process data with validation, caching, and error handling
        
        Args:
            data: Input data dictionary
            
        Returns:
            Processed result dictionary
            
        Raises:
            ValueError: If validation fails
            RuntimeError: If processing fails after retries
        """
        if not self.validate(data):
            raise ValueError("Invalid input data structure")
        
        cache_key = f"{data['id']}:{data['timestamp']}"
        
        # Check cache
        if self.config.cache_enabled and cache_key in self._cache:
            self._metrics['cache_hits'] += 1
            logger.debug(f"Cache hit for key: {cache_key}")
            return self._cache[cache_key]
        
        # Process with retry logic
        for attempt in range(self.config.max_retries):
            try:
                result = await self._execute_processing(data)
                
                if self.config.cache_enabled:
                    self._cache[cache_key] = result
                
                self._metrics['processed'] += 1
                return result
                
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed: {str(e)}")
                if attempt == self.config.max_retries - 1:
                    self._metrics['failed'] += 1
                    raise RuntimeError(f"Processing failed after {self.config.max_retries} attempts") from e
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
        
        raise RuntimeError("Unexpected processing failure")
    
    async def _execute_processing(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the actual processing logic"""
        # Simulate async processing
        await asyncio.sleep(0.01)
        
        return {
            'success': True,
            'data': data['payload'],
            'processed_at': datetime.utcnow().isoformat(),
            'config': self.config.metadata
        }
    
    def get_metrics(self) -> Dict[str, int]:
        """Return processing metrics"""
        return self._metrics.copy()
    
    def clear_cache(self) -> None:
        """Clear the internal cache"""
        self._cache.clear()
        logger.info("Cache cleared")


class FeatureManager:
    """High-level manager for feature operations"""
    
    def __init__(self):
        self.processors: List[FeatureProcessor] = []
    
    def add_processor(self, processor: FeatureProcessor) -> None:
        """Add a processor to the manager"""
        self.processors.append(processor)
    
    async def process_batch(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process multiple items concurrently"""
        if not self.processors:
            raise ValueError("No processors available")
        
        processor = self.processors[0]
        tasks = [processor.process(item) for item in items]
        return await asyncio.gather(*tasks, return_exceptions=True)


# Factory function
def create_feature_processor(config: Optional[Dict[str, Any]] = None) -> FeatureProcessor:
    """Factory function to create configured processor"""
    if config:
        feature_config = FeatureConfig(**config)
    else:
        feature_config = FeatureConfig()
    
    return FeatureProcessor(feature_config)
