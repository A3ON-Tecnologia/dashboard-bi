## Dashboard Workflows

Aplicação web em Flask para gerenciar workflows de análise financeira. Cada workflow suporta dois fluxos:

- **Balancete** – upload único de planilha com indicadores, criação de gráficos comparativos.
- **Análise JP** – múltiplos uploads categorizados, criação de gráficos por categoria.

A interface unifica os fluxos, mantém o tema escolhido e opera sobre uma API REST própria.

---

### 1. Requisitos

- Python 3.11+ (desenvolvido com 3.13.7)
- MySQL 5.7+ (ou MariaDB com suporte a `JSON`)
- Dependências listadas em `requirements.txt`

---

### 2. Configuração do ambiente

```bash
git clone <seu-repo>
cd dashboard
python -m venv venv
venv\Scripts\activate      # PowerShell (Windows)
# source venv/bin/activate # Linux/macOS
pip install -r requirements.txt
```

---

### 3. Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```
SECRET_KEY=algum_valor_seguro
DATABASE_URL=mysql+pymysql://usuario:senha@localhost:3306/nome_do_banco
UPLOAD_FOLDER=uploads
MAX_UPLOAD_SIZE_MB=15
```

> Ajuste `DATABASE_URL` para sua instância MySQL (o schema já deve existir).

---

### 4. Banco de dados

Com o banco criado e credenciais configuradas:

1. Aplique o script fornecido anteriormente para recriar as tabelas:
   - `workflows`
   - `arquivos_importados`
   - `analise_uploads`
   - `dashboards`
   - `analise_jp_charts`
2. Certifique-se de que o usuário tem permissão de leitura/escrita na pasta definida em `UPLOAD_FOLDER`.

---

### 5. Executando a aplicação

```bash
venv\Scripts\activate
flask --app run.py run
```

A aplicação iniciará em `http://127.0.0.1:8000`.

---

### 6. Fluxo de uso

1. **Criar workflow** – escolha nome, descrição (opcional) e tipo (`balancete` ou `analise_jp`).
2. **Uploads**  
   - *Balancete*: enviar arquivo `.csv` ou `.xlsx` com colunas `Indicador`, `Período 1`, `Período 2`, `Diferença Absoluta`, `Diferença %`. A visualização em tabela é automática; o upload pode ser substituído.
   - *Análise JP*: cada categoria (Simples Nacional, Lucro Real, etc.) aceita um upload independente. Tabelas podem ser visualizadas, ocultadas e removidas por categoria.
3. **Dashboards**  
   - Clique em “Novo gráfico” para abrir o modal em 3 etapas:
     1. Tipo de gráfico (barras, linha, área, pizza/donut ou tabela).
     2. Seleção de indicadores/dimensões, métricas, cores e linhas incluídas.
     3. Pré-visualização com valores formatados (R$ ou %).
   - Gráficos criados aparecem em tela cheia (um por linha) e podem ser editados ou excluídos.

---

### 7. Estrutura principal

```
app/
├── extensions.py               # Instâncias compartilhadas (SQLAlchemy)
├── __init__.py                 # Fábrica do Flask
├── models/                     # Modelos SQLAlchemy
├── routes/
│   ├── api.py                  # API REST
│   └── web.py                  # Páginas HTML
├── services/
│   ├── workflow_import_service.py   # Upload balancete
│   └── analise_jp_service.py        # Uploads categorizados
├── static/js/                  # Scripts do front-end
└── templates/                  # Layouts e páginas
```

---

### 8. Testes rápidos

Com o servidor rodando:

- `POST /api/workflows` cria workflow (útil para automação/manipulação via API).
- `GET /api/workflows/<id>` retorna o payload completo com uploads e gráficos.
- Use a interface web para validar: criação, uploads, pré-visualizações e gráficos.

---

### 9. Observações

- A aplicação não possui autenticação; qualquer usuário com acesso ao servidor controla todos os workflows.
- `UPLOAD_FOLDER` é usado tanto para balancete quanto para Análise JP. Para limpar dados, apague a pasta e recrie tabelas.
- Se quiser versionar uploads em produção, considere mover o diretório para armazenamento dedicado.

Pronto! Após esses passos o sistema fica disponível com os fluxos refatorados e prontos para uso. Qualquer dúvida é só chamar. :)
