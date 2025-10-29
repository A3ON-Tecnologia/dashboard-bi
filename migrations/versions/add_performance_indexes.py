"""add performance indexes

Revision ID: perf_indexes_001
Revises: 
Create Date: 2025-10-28

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'perf_indexes_001'
down_revision = '1a2b3c4d5e6f'  # add_hidden_rows_to_analise_uploads
branch_labels = None
depends_on = None


def upgrade():
    # Índice composto para AnaliseUpload (workflow_id + categoria + created_at)
    op.create_index(
        'idx_analise_upload_workflow_cat_date',
        'analise_uploads',
        ['workflow_id', 'categoria', 'created_at'],
        unique=False
    )
    
    # Índice composto para ArquivoImportado (workflow_id + data_upload)
    op.create_index(
        'idx_arquivo_importado_workflow_date',
        'arquivos_importados',
        ['workflow_id', 'data_upload'],
        unique=False
    )
    
    # Índice composto para Dashboard (workflow_id + created_at)
    op.create_index(
        'idx_dashboard_workflow_date',
        'dashboards',
        ['workflow_id', 'created_at'],
        unique=False
    )
    
    # Índice composto para AnaliseJPChart (workflow_id + categoria + created_at)
    op.create_index(
        'idx_analise_jp_chart_workflow_cat_date',
        'analise_jp_charts',
        ['workflow_id', 'categoria', 'created_at'],
        unique=False
    )


def downgrade():
    op.drop_index('idx_analise_jp_chart_workflow_cat_date', table_name='analise_jp_charts')
    op.drop_index('idx_dashboard_workflow_date', table_name='dashboards')
    op.drop_index('idx_arquivo_importado_workflow_date', table_name='arquivos_importados')
    op.drop_index('idx_analise_upload_workflow_cat_date', table_name='analise_uploads')
