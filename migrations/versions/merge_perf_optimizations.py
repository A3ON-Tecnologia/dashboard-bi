"""merge performance optimizations

Revision ID: merge_perf_opt_001
Revises: 98448ea0fea6, metadata_cache_001
Create Date: 2025-10-28

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'merge_perf_opt_001'
down_revision = ('98448ea0fea6', 'metadata_cache_001')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
