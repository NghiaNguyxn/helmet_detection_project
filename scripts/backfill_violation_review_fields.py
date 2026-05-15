import argparse
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


REVIEW_FIELD_DEFAULTS = {
    "status": "confirmed",
    "reviewed_by": None,
    "reviewed_at": None,
    "review_note": None,
    "rejection_reason": None,
}


def load_settings(env_file: Path) -> tuple[str, str, str]:
    load_dotenv(env_file)

    mongo_url = os.getenv("MONGO_URL")
    database_name = os.getenv("DATABASE_NAME")
    violation_collection = os.getenv("VIOLATION_COLLECTION")

    missing = [
        name
        for name, value in {
            "MONGO_URL": mongo_url,
            "DATABASE_NAME": database_name,
            "VIOLATION_COLLECTION": violation_collection,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(f"Missing required environment values: {', '.join(missing)}")

    return mongo_url, database_name, violation_collection


async def inspect_collection(collection) -> dict:
    stats = {
        "total": await collection.count_documents({}),
        "missing_status": await collection.count_documents({"status": {"$exists": False}}),
    }

    for field in ("reviewed_by", "reviewed_at", "review_note", "rejection_reason"):
        stats[f"missing_{field}"] = await collection.count_documents({field: {"$exists": False}})

    return stats


async def run_backfill(args: argparse.Namespace) -> None:
    mongo_url, database_name, collection_name = load_settings(args.env_file)

    client = AsyncIOMotorClient(mongo_url)
    try:
        await client.admin.command("ping")
        collection = client[database_name][collection_name]

        stats = await inspect_collection(collection)
        print("Violation review-field backfill")
        print(f"Environment file: {args.env_file}")
        print(f"Database: {database_name}")
        print(f"Collection: {collection_name}")
        print(f"Total documents: {stats['total']}")
        print(f"Documents missing status: {stats['missing_status']}")
        print(f"Documents missing reviewed_by: {stats['missing_reviewed_by']}")
        print(f"Documents missing reviewed_at: {stats['missing_reviewed_at']}")
        print(f"Documents missing review_note: {stats['missing_review_note']}")
        print(f"Documents missing rejection_reason: {stats['missing_rejection_reason']}")

        if not args.apply:
            print("")
            print("Dry run only. Re-run with --apply to update documents missing status.")
            return

        result = await collection.update_many(
            {"status": {"$exists": False}},
            {"$set": REVIEW_FIELD_DEFAULTS},
        )

        print("")
        print("Backfill applied.")
        print(f"Matched documents: {result.matched_count}")
        print(f"Modified documents: {result.modified_count}")

        updated_stats = await inspect_collection(collection)
        print(f"Documents still missing status: {updated_stats['missing_status']}")
    finally:
        client.close()


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    default_env_file = repo_root / "SourceCode" / "BE" / ".env"

    parser = argparse.ArgumentParser(
        description=(
            "Backfill existing MongoDB violation documents with review workflow fields. "
            "Dry-run by default; use --apply to update documents."
        )
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply the backfill. Without this flag, the script only reports counts.",
    )
    parser.add_argument(
        "--env-file",
        type=Path,
        default=default_env_file,
        help="Path to the backend .env file.",
    )
    return parser.parse_args()


def main() -> None:
    asyncio.run(run_backfill(parse_args()))


if __name__ == "__main__":
    main()
