import logging
from sqlalchemy.orm import Session

from app.models.pitch_deck import PitchDeck, DeckStatus
from app.services.groq_service import generate_slides
from app.services.pptx_service import build_pptx
from app.services.image_service import fetch_slide_images
from app.services.activity_report import report_activity_sync
from app.services import credits_service
from app.core.credits_db import CreditsSessionLocal

logger = logging.getLogger(__name__)


JOB_STORE = {}


def set_job_status(job_id, status, deck_id=None, message=None):
    JOB_STORE[job_id] = {
        "status": status,
        "deck_id": deck_id,
        "message": message,
    }


def get_job_status(job_id):
    return JOB_STORE.get(job_id)


def process_deck_job(
    job_id: str,
    deck_id: str,
    user_id: str,
    input_type: str,
    data: dict,
    db: Session,
    reference_id: str,
    theme: str = "gmbte",
):

    logger.info(
        "[Worker] Starting job %s for deck %s",
        job_id,
        deck_id
    )

    deck = (
        db.query(PitchDeck)
        .filter(PitchDeck.id == deck_id)
        .first()
    )

    if not deck:
        set_job_status(
            job_id,
            "failed",
            message="Deck record not found"
        )
        return


    try:

        deck.status = DeckStatus.processing
        db.commit()

        set_job_status(
            job_id,
            "processing",
            deck_id
        )


        logger.info("[Worker] Generating slides")

        slides_json = generate_slides(
            input_type=input_type,
            data=data
        )


        logger.info("[Worker] Fetching images")

        keywords = (
            f"{data.get('title','')} "
            f"{data.get('idea','')}"
        )

        slide_images = fetch_slide_images(
            slides_json.get("slides", []),
            keywords
        )


        logger.info("[Worker] Building PPTX")

        file_path = build_pptx(
            slides_data=slides_json,
            deck_id=str(deck_id),
            theme_name=theme,
            slide_images=slide_images,
        )


        deck.slides_json = slides_json
        deck.file_path = file_path
        deck.status = DeckStatus.done

        db.commit()

        credits_db = CreditsSessionLocal()
        try:
            credits_service.commit_credits(credits_db, user_id, reference_id)
        finally:
            credits_db.close()

        report_activity_sync(
            user_id,
            "PITCH_DECK_GENERATED",
            f"Generated a pitch deck \"{data.get('title') or data.get('idea') or 'Untitled'}\"",
            {"deckId": str(deck_id)},
        )


        set_job_status(
            job_id,
            "done",
            deck_id
        )


        logger.info(
            "[Worker] Job %s completed",
            job_id
        )


    except Exception as e:

        logger.exception(
            "[Worker] Job failed"
        )

        deck.status = DeckStatus.failed
        deck.error_message = str(e)

        db.commit()

        credits_db = CreditsSessionLocal()
        try:
            credits_service.refund_credits(credits_db, user_id, reference_id)
        finally:
            credits_db.close()

        set_job_status(
            job_id,
            "failed",
            deck_id,
            str(e)
        )


    finally:
        db.close()
