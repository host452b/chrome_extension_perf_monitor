function createBucket(timestamp, snapshotEntry) {
  return {
    timestamp,
    requests: snapshotEntry.requests,
    bytesTransferred: snapshotEntry.bytes,
    byType: { ...snapshotEntry.byType },
    topDomains: { ...snapshotEntry.topDomains },
  };
}

function mergeSnapshotIntoActivity(activity, snapshot, timestamp) {
  const result = {};
  for (const [extId, data] of Object.entries(activity)) {
    result[extId] = { buckets: [...data.buckets] };
  }
  for (const [extId, entry] of Object.entries(snapshot)) {
    if (!result[extId]) {
      result[extId] = { buckets: [] };
    }
    result[extId].buckets.push(createBucket(timestamp, entry));
  }
  return result;
}

function pruneOldBuckets(activity, now, retentionMs) {
  const cutoff = now - retentionMs;
  const result = {};
  for (const [extId, data] of Object.entries(activity)) {
    const kept = data.buckets.filter(b => b.timestamp >= cutoff);
    if (kept.length > 0) {
      result[extId] = { buckets: kept };
    }
  }
  return result;
}

if (typeof module !== 'undefined') {
  module.exports = { createBucket, mergeSnapshotIntoActivity, pruneOldBuckets };
}
