"""create ideas table

Revision ID: 001_create_ideas
Revises:
Create Date: 2026-07-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_create_ideas"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ideas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("business_idea", sa.String(), nullable=False),
        sa.Column("industry", sa.String(), server_default="", nullable=False),
        sa.Column("target_audience", sa.String(), server_default="", nullable=False),
        sa.Column("skills", sa.String(), server_default="", nullable=False),
        sa.Column("budget", sa.String(), server_default="", nullable=False),
        sa.Column("location", sa.String(), server_default="", nullable=False),
        sa.Column("experience_level", sa.String(), server_default="", nullable=False),
        sa.Column("goal", sa.String(), server_default="", nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_ideas_user_id", "ideas", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_ideas_user_id", table_name="ideas")
    op.drop_table("ideas")
