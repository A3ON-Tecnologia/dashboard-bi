"""add metadata to analise_upload

Revision ID: metadata_cache_001
Revises: perf_indexes_001
Create Date: 2025-10-28

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'metadata_cache_001'
down_revision = 'perf_indexes_001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('analise_uploads', sa.Column('cache_metadata', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('analise_uploads', 'cache_metadata')
