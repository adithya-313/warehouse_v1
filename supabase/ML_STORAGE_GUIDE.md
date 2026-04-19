# Supabase Storage Guide: ml-models Bucket

## Overview
This guide covers how to interact with the `ml-models` and `training-data` buckets using the Supabase JavaScript client.

## Bucket Configuration
| Bucket | ID | Public | Max File Size | Allowed Types |
|--------|-----|--------|---------------|---------------|
| ml-models | ml-models | Private | 500MB | .json, .bin |
| training-data | training-data | Private | 1GB | .parquet, .bin |

## Client Setup
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for full access
);
```

## Upload ML Model Files

### Upload XGBoost Model Weights (.bin)
```typescript
async function uploadModelWeights(file: File, modelName: string) {
  const filePath = `xgboost/${modelName}/${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('ml-models')
    .upload(filePath, file, {
      contentType: 'application/octet-stream',
      upsert: true
    });

  if (error) throw error;
  return data;
}
```

### Upload TFT Model Configuration (.json)
```typescript
async function uploadModelConfig(config: object, modelName: string) {
  const filePath = `tft/${modelName}/config.json`;
  const file = new Blob([JSON.stringify(config)], { type: 'application/json' });

  const { data, error } = await supabase.storage
    .from('ml-models')
    .upload(filePath, file, {
      contentType: 'application/json',
      upsert: true
    });

  if (error) throw error;
  return data;
}
```

## Download ML Model Files
```typescript
async function downloadModel(modelType: string, modelName: string) {
  const { data, error } = await supabase.storage
    .from('ml-models')
    .download(`${modelType}/${modelName}/model.bin`);

  if (error) throw error;
  return data;
}
```

## List Available Models
```typescript
async function listModels() {
  const { data, error } = await supabase.storage
    .from('ml-models')
    .list('', { limit: 100 });

  if (error) throw error;
  return data;
}
```

## Upload Training Data Snapshots (.parquet)
```typescript
async function uploadTrainingSnapshot(data: Buffer, date: string) {
  const filePath = `snapshots/${date}/training_data.parquet`;

  const { data: uploaded, error } = await supabase.storage
    .from('training-data')
    .upload(filePath, data, {
      contentType: 'application/octet-stream',
      upsert: true
    });

  if (error) throw error;
  return uploaded;
}
```

## Get Public URL (for signed URLs)
```typescript
async function getSignedDownloadUrl(modelPath: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from('ml-models')
    .createSignedUrl(modelPath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}
```

## Delete Model Files
```typescript
async function deleteModel(modelPath: string) {
  const { error } = await supabase.storage
    .from('ml-models')
    .remove([modelPath]);

  if (error) throw error;
}
```

## RLS Access Summary
| Role | Read | Upload | Delete |
|------|------|--------|--------|
| authenticated | ✓ | ✗ | ✗ |
| warehouse_worker | ✓ | ✗ | ✗ |
| service_role | ✓ | ✓ | ✓ |
