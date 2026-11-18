# MAC Vision — GitHub Pages + Supabase partilhado

## Estado desta versão

A base de dados **PDS** no Supabase foi reativada e recebeu quatro novas tabelas: `mac_vision_profiles`, `mac_vision_shop_access`, `mac_vision_docs` e `mac_vision_directory`, com Row Level Security e um bucket privado para ficheiros importados. As tabelas antigas `pds_*` ficaram intactas.

O ficheiro `index.html` foi adaptado para ler e guardar **vendas, senhas, escalas, colaboradores e configurações por loja** no Supabase, através de `cloud-bridge.js`. Os utilizadores entram por **Supabase Auth (email e palavra-passe)**; os perfis e permissões de loja são confirmados pelo servidor. As gravações utilizam revisão otimista para impedir que uma alteração silenciosamente apague outra; novas vendas com identificadores distintos podem ser reconciliadas automaticamente. Caso contrário, é mostrado um erro e a operação não é dada como concluída.

**Atenção:** esta integração não foi testada de ponta a ponta com um utilizador autenticado. A base de dados existe e as políticas estão instaladas, mas **ainda não há nenhum perfil MAC Vision associado à autenticação Supabase**. Não utilizar esta versão com dados reais sem validação prévia.

## 1. Preparar o administrador

1. Abrir [Supabase PDS](https://supabase.com/dashboard/project/qeayqemdntguzcsgofbg).
2. Em **Authentication → Users**, criar (ou identificar) a conta de email do administrador. Configurar uma palavra-passe forte. Não abrir registos livres sem controlo.
3. Em **SQL Editor**, executar apenas a primeira instrução do ficheiro `02_criar_perfis.sql`, depois de substituir `EMAIL_DO_ADMIN` pelo email exato do administrador.
4. Confirmar que existe um perfil:
   ```sql
   select p.display_name, p.role, u.email from public.mac_vision_profiles p join auth.users u on u.id=p.user_id;
   ```

## 2. Atualizar o GitHub Pages

Repositório: https://github.com/retrovision-pt/mac-vision

Carregar para a **raiz** da branch `main`, substituindo os ficheiros existentes quando solicitado:

- `index.html`
- `cloud-bridge.js`
- `cloud-config.js`
- `.nojekyll`

**Não é necessário publicar `01_base_de_dados.sql`, `02_criar_perfis.sql` ou um backup de dados**. O ficheiro `cloud-config.js` inclui somente a URL do projeto e uma chave **publishable**, concebida para uso no browser. Nunca inserir `service_role` ou `sb_secret_*` no GitHub.

Em **Settings → Pages**, selecionar **Deploy from a branch → main → / (root) → Save**. O endereço habitual é https://retrovision-pt.github.io/mac-vision/ .

## 3. Iniciar pela primeira vez

- Abrir a página publicada, introduzir o email e a palavra-passe do administrador do Supabase.
- Se a instalação não tiver lojas criadas, o MAC Vision apresenta o assistente de criação do Gestor de Área e das lojas. Ao concluir, associa automaticamente a conta Auth a essa identidade.
- Se já existirem lojas e contas na base de dados, é preciso associar a conta ao `app_user_id` correspondente, em `mac_vision_profiles`. Não existem contas criadas automaticamente a partir da antiga Cloud.

## 4. Dar acesso aos colaboradores e gestores

Para cada colaborador autorizado:

1. Criar o utilizador no MAC Vision (menu de gestão), com o cargo e loja corretos.
2. Em **Supabase → Authentication → Users**, adicionar a conta de email do colaborador.
3. Consultar os IDs no ficheiro `02_criar_perfis.sql` e adicionar um perfil `colaborador` ou `gestor` com o `app_user_id` correspondente.
4. Criar a associação da conta à loja em `mac_vision_shop_access`. O campo `can_write` controla a gravação dos dados da loja.

As palavras-passe do MAC Vision antigo não são reutilizadas como palavras-passe do Supabase. A autenticação central é a identidade válida. A interface de gestão de contas da aplicação ainda não cria automaticamente contas de email na plataforma Supabase.

## 5. Migração de dados

**Nenhum dado foi transferido** do antigo Lovable Cloud ou do IndexedDB do browser para o Supabase. É necessário exportar um backup antes de substituir a versão anterior e importar os registos através de um processo validado. Para assegurar que os IDs e as lojas são preservados, não misturar backups de lojas diferentes sem conferência. As tabelas instaladas começam vazias.

## Limitações e segurança

- **Chat Vision** continua local neste pacote; as mensagens não são sincronizadas entre equipamentos. A sincronização do chat exige tabelas e políticas específicas.
- As definições globais de apresentação e alguns dados temporários de configuração continuam locais. Os dados operacionais da loja são remotos.
- O registo por loja é guardado como documento JSON. As regras impedem acesso a lojas não autorizadas, mas não restringem *cada campo comercial* individualmente. Antes de uma produção com dados sensíveis, convém dividir vendas, senhas e escalas em tabelas próprias e aplicar permissões detalhadas.
- Se o Supabase estiver inacessível, a aplicação **não** confirma gravações falsas. Recomenda-se exportar backups regulares e vigiar os alertas de erro.
- O Supabase Free tem limites de uso e pode colocar projetos inativos em pausa.
- Fazer testes com uma conta de administrador e uma de colaborador antes de distribuir o link.
