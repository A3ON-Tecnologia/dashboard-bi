from app import create_app

app = create_app()


if __name__ == "__main__":
    # CORREÇÃO: Adicionar host='0.0.0.0' para escutar em todas as interfaces de rede.
    # O debug=True é ideal para teste, mas nunca deve ser usado em produção.
    app.run(debug=True, host='0.0.0.0', port=3000)