# MAC Vision

## Reposição total e instalação limpa (12/11)
- [x] Cópia de segurança privada antes da eliminação; zero contas, carteiras, lojas, vendas, mensagens e passwords após o reset.
- [x] Causas corrigidas: sincronização que apagava acessos, login que alterava passwords, autopreenchimento do navegador nos campos de criação, contas de carteiras sem GA no ecrã de entrada; mensagem de ligação privada removida.
- [x] Configuração inicial termina só com lojas; GL e colaboradores adicionados depois pelos menus originais.
- [x] Testado com dados temporários (apagados): GA, carteira em maiúsculas, loja sem GL, GL e colaborador, recarregar, entrar noutro computador, password errada, password inalterada.
- [ ] Criação real do GA e da configuração: aguarda o utilizador. Publicação aguarda autorização.

## Integridade de utilizadores e passwords
- [x] Gestor MAC Vision mantém tipo administrativo protegido e acesso administrativo total após reabrir; não atribuir privilégios apenas pelo nome.
- [x] Guardar cópia privada do estado Cloud antes de alterações; inventariar contas e operações destrutivas.
- [x] Sincronização incremental sem eliminação implícita; remoção de acesso separada e autorizada; login sem atualização de credenciais.
- [x] Duas sessões autenticadas preservam os quatro acessos das duas contas após gravação parcial e reabertura; datas das credenciais inalteradas; relatório entregue.
- [ ] Testes solicitados de novo GA, três colaboradores, venda e escala com dados reais: aguardam configuração do utilizador; não criar contas fictícias ou outro GA nem alterar registos reais.

## Reposição autorizada de todas as contas
- [x] Eliminadas 13 identidades pela administração Auth; consulta final confirma zero utilizadores, sessões, refresh tokens, perfis, permissões, associações, credenciais e presenças. Carteiras e dados comerciais preservados.
- [x] Formulário original abre automaticamente no Preview e após atualizar, em 1280×1800 e 591×754; autorização backend única até 26/11, indisponível em produção; nomes de carteiras anteriores continuam protegidos.
- [ ] Verificar o formulário sem criar dados fictícios; criação real e configuração de lojas aguardam os dados introduzidos pelo utilizador.

## Passwords numéricas e criação do GA
- [x] Password de mínimo 4 números para GA, gestores e colaboradores, validada só na Cloud com impressão digital protegida, bloqueio após 5 tentativas e sessão real; contas antigas apenas validadas no login, sem conversão automática.
- [x] Mensagens técnicas em inglês substituídas por mensagens em português.
- [x] Testado com 4, 5 e 6 dígitos: GA, loja, gestor, colaborador, login noutro navegador e bloqueio; carteiras TESTEPIN4/5/6 mantidas até autorização para apagar.
- [ ] Ligação publicada: aguarda autorização para publicar.

## Recuperar criação do GA
- [x] Reabrir a configuração original para uma carteira real separada, por autorização privada de utilização única; formulário verificado em computador e no tamanho atual do Preview.
- [x] Implementar criação transacional de carteira, GA e permissões, autorização de 14 dias, proteção de carteiras existentes e retoma autenticada da configuração pendente; 14 testes passaram.
- [ ] Verificar criação real do GA, primeiras lojas, login posterior e persistência: aguarda nomes e password introduzidos pelo utilizador na ligação privada; não criar contas fictícias nem consumir a autorização em testes.

## Auditoria integral solicitada
- [x] Inventariar chamadas locais e operações Cloud; relatório distingue caminhos inspecionados de operações realmente testadas.
- [x] Corrigir falsos sucessos offline, recibos, snapshots, conflitos no mesmo campo, preferências atómicas e metadados persistidos.
- [x] Executar testes de venda, MOVIIK, horários, chat, recibos, novo navegador e falha de ligação; IndexedDB vazio e apenas autenticação em localStorage real.
- [x] Entregar relatório tabelado com provas, tabelas/funções, riscos e seis respostas finais, sem certificação de 100%.
- [x] Retirar o badge Lovable, sem publicar.

- [x] Abrir o HTML original no Preview, preservando integralmente a interface e o ecrã Bem-vindo; verificado em computador e telemóvel, com 13 entradas de navegação presentes.
- [x] Ligar Lovable Cloud e os formulários originais à autenticação, sem email visível ou novos campos; criação de administrador, gestor e colaborador verificada.
- [x] Instalação Cloud nova: sem importar registos antigos; dados de verificação apagados com autorização específica.
- [x] Armazenamento Cloud de registos, configurações, perfis e anexos; revisions e merge com testes de concorrência.
- [x] Venda sincronizada em dois navegadores, importação MOVIIK, download de anexo, mensagens gerais e privadas entre duas lojas e persistência após reabrir verificados.
- [x] Nome da Carteira e conversão para maiúsculas verificados.
- [ ] Certificação 100%: editor/criação de lojas, revogação, metadados em tempo real, dois colaboradores em lojas distintas, eliminações e testes de volume não concluídos; não classificados como confirmados no relatório.
- [ ] Validação de fórmulas comerciais reais: aguarda catálogo e regras reais fornecidos pelo utilizador.
- [ ] Limpeza dos dados comerciais da carteira AUDITORIA20261111: não autorizada; as contas foram eliminadas na reposição, mas vendas, anexos e mensagens foram preservados.

## Ponderação e Comissionamento partilhado
- [x] Um único ficheiro de comissionamento por carteira, associado a várias lojas; o catálogo é guardado uma só vez na Cloud e lido por todas as lojas associadas.
- [x] Popup original preservado: escolha de lojas com pesquisa, todas/nenhuma, pessoas, produtos e tarifários; só o estado passa a ser partilhado.
- [x] Cache local por carteira, ficheiro e versão; o catálogo só se descarrega quando a versão local não coincide.
- [x] Versões e permissões: colaborador não grava; revisão otimista rejeita gravações de outra sessão; na mesma versão só são aceites associações com o mesmo catálogo.
- [x] Atualização imediata quando outra sessão grava: nova versão aplicada e anunciada; estado "● Ficheiro partilhado · nome · vN · produtos · tarifários · lojas · atualizado por".
- [x] Loja sem registo próprio recebe o catálogo partilhado sem criar cópia; a cópia local nunca volta a ser gravada na loja.
- [x] Verificado de ponta a ponta com dados de teste apagados depois: guardar, segunda loja, recarregar, cache, conflito de versão e atualização por outra sessão.
- [ ] Importação do ficheiro real do utilizador e validação das fórmulas comerciais: aguarda o ficheiro e a autorização para importar.

Não publicar sem autorização.