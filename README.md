# Estoque por Produto

Ferramenta para somar o estoque das variações (cor × tamanho) de cada produto a partir da exportação da **Lista de Estoque do UpSeller**.

## Como usar

1. No UpSeller, exporte a Lista de Estoque (.xlsx).
2. Abra `index.html` no navegador.
3. Clique em **Carregar arquivo** ou arraste o .xlsx para a página.

## O que mostra

- Total de peças por produto (código = 5 primeiros dígitos do SKU, ajustável)
- Variações, variações zeradas e valor em estoque pelo custo médio
- Grade cor × tamanho de cada produto (zerado em vermelho, 1–2 peças em amarelo)
- Filtro de **grade quebrada** (produto com estoque e algum tamanho zerado)
- Alternância entre estoque Disponível e Estoque Atual
- Botão para copiar o resumo e colar no Excel

O arquivo é lido apenas no navegador; nenhum dado é enviado para servidor.
