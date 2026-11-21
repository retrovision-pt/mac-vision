type Account={id:string;wallet_id:string;role:string;admin_type:string;disabled?:boolean};
export function removalError(actor:Account,target:Account,owner:string,admins:Account[],global:boolean):string|null{
 if(actor.disabled||target.disabled||actor.role!=='admin'||actor.wallet_id!==target.wallet_id)return 'Sem permissão para remover este acesso.';
 if(actor.id===target.id)return 'Não podes remover a própria sessão.';
 if(target.id===owner)return 'O dono da carteira não pode ser removido.';
 if((global||target.role==='admin')&&actor.admin_type!=='mac'&&actor.id!==owner)return 'Só o Gestor MAC Vision pode remover este acesso global.';
 const active=admins.filter(a=>!a.disabled&&a.wallet_id===actor.wallet_id&&a.role==='admin');
 if(global&&target.role==='admin'&&(active.length<=1||(target.admin_type==='mac'&&active.filter(a=>a.admin_type==='mac').length<=1)))return 'É necessário manter o último administrador global.';
 return null;
}