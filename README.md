# MAC Vision — publicação no GitHub Pages

Este pacote inclui o ficheiro `index.html`, preparado para publicação no GitHub Pages, e `.nojekyll`.

## Publicar o site

1. Cria um repositório no GitHub (por exemplo, `mac-vision`).
2. Extrai este ZIP e coloca `index.html` e `.nojekyll` na raiz do repositório.
3. Faz commit dos ficheiros.
4. Abre **Settings → Pages** e escolhe **Deploy from a branch**, `main`, `/ (root)` e **Save**.
5. O site ficará, normalmente, em `https://<utilizador>.github.io/<repositorio>/` após a publicação.

## Importante: esta versão ainda é LOCAL

Esta versão guarda lojas, utilizadores, vendas, senhas MOVIIK e outros dados no IndexedDB do navegador. Não grava registos no repositório GitHub e NÃO sincroniza alterações entre computadores, navegadores ou telemóveis.

Para que os dados sejam partilhados entre todos os utilizadores, é obrigatório integrar um backend com autenticação e permissões por loja (por exemplo, Supabase, Firebase ou um backend próprio). A mera publicação do `index.html` no GitHub Pages não oferece essa funcionalidade.

Não colocar passwords privadas, chaves secretas de API, ficheiros de dados de clientes ou exportações de vendas no repositório público.

## Migração de dados

Como o armazenamento local pertence à origem (endereço) do site, os dados guardados quando abrias um HTML no computador NÃO aparecem automaticamente quando abrires o site publicado no GitHub Pages. Exporta um backup antes de mudar e restaura-o na versão publicada, se necessário. Essa importação fica apenas no navegador utilizado.

## Passo seguinte para a base de dados partilhada

1. Escolher e ativar/criar a base de dados de destino.
2. Configurar autenticação individual e regras de acesso por loja no servidor.
3. Adaptar os mecanismos de leitura, escrita, anexos e Chat Vision do HTML a essa base de dados.
4. Testar inserções e atualizações simultâneas de vários utilizadores, com prevenção de perdas de dados.
5. Só depois publicar a versão partilhada.
