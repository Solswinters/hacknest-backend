"""
Unit tests for feature module
"""
import pytest
import asyncio
from unittest.mock import Mock, patch
from feature import FeatureProcessor, FeatureConfig, FeatureManager


@pytest.fixture
def processor():
    """Create a feature processor for testing"""
    config = FeatureConfig(max_retries=2, timeout=10)
    return FeatureProcessor(config)


@pytest.fixture
def sample_data():
    """Sample data for testing"""
    return {
        'id': 'test-123',
        'timestamp': 1234567890,
        'payload': {'key': 'value'}
    }


class TestFeatureProcessor:
    """Test cases for FeatureProcessor"""
    
    @pytest.mark.asyncio
    async def test_process_valid_data(self, processor, sample_data):
        """Test processing valid data"""
        result = await processor.process(sample_data)
        
        assert result['success'] is True
        assert 'processed_at' in result
        assert result['data'] == sample_data['payload']
    
    @pytest.mark.asyncio
    async def test_cache_functionality(self, processor, sample_data):
        """Test that cache works correctly"""
        result1 = await processor.process(sample_data)
        result2 = await processor.process(sample_data)
        
        assert result1 == result2
        metrics = processor.get_metrics()
        assert metrics['cache_hits'] == 1
    
    def test_validate_valid_data(self, processor, sample_data):
        """Test validation with valid data"""
        assert processor.validate(sample_data) is True
    
    def test_validate_invalid_data(self, processor):
        """Test validation with invalid data"""
        invalid_data = {'id': 'test'}
        assert processor.validate(invalid_data) is False
    
    @pytest.mark.asyncio
    async def test_process_invalid_data(self, processor):
        """Test processing with invalid data raises error"""
        invalid_data = {'invalid': 'data'}
        
        with pytest.raises(ValueError):
            await processor.process(invalid_data)
    
    def test_get_metrics(self, processor):
        """Test metrics retrieval"""
        metrics = processor.get_metrics()
        
        assert 'processed' in metrics
        assert 'failed' in metrics
        assert 'cache_hits' in metrics
    
    def test_clear_cache(self, processor):
        """Test cache clearing"""
        processor.clear_cache()
        assert len(processor._cache) == 0


class TestFeatureManager:
    """Test cases for FeatureManager"""
    
    @pytest.mark.asyncio
    async def test_process_batch(self, sample_data):
        """Test batch processing"""
        manager = FeatureManager()
        processor = FeatureProcessor()
        manager.add_processor(processor)
        
        items = [sample_data, sample_data.copy()]
        results = await manager.process_batch(items)
        
        assert len(results) == 2
        assert all(isinstance(r, dict) for r in results)
