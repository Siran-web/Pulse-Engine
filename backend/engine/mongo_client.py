"""
engine/mongo_client.py — Fetches unified rules from single `rules` collection.
No more composite_rules collection.
"""
import os
from pymongo import MongoClient
import certifi

_client = None
_db = None

def _get_db():
    global _client, _db
    if _db is None:
        mongo_uri = os.environ.get('MONGO_URI')
        if not mongo_uri:
            raise Exception("MONGO_URI not found in .env")
        _client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        _db = _client.get_default_database()
        _client.admin.command('ping')
        print(f'✅  Python engine connected to MongoDB')
    return _db


def get_rules(context: str, hospital_id=None) -> list:
    """
    Fetch active unified rules for a given context + hospital scope.
    Returns a flat list of rule dicts (no more tuple of simple+composite).
    """
    db = _get_db()

    # context is stored as array in MongoDB — this matches if context is IN the array
    base_filter = {
        'active':  True,
        'context': context
    }

    if hospital_id:
        scope_filter = {
            '$or': [
                { 'scope': 'global' },
                { 'scope': 'hospital-specific', 'hospital_id': int(hospital_id) }
            ]
        }
    else:
        scope_filter = { 'scope': 'global' }

    query = { **base_filter, **scope_filter }

    cursor = db['rules'].find(query)
    rules  = [_doc_to_dict(doc) for doc in cursor]

    print(f'📋  {len(rules)} rules fetched for context={context}, hospital_id={hospital_id}')
    return rules


def _doc_to_dict(doc: dict) -> dict:
    from bson import ObjectId
    result = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, list):
            result[key] = [str(v) if isinstance(v, ObjectId) else v for v in value]
        else:
            result[key] = value
    return result