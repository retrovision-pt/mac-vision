import { describe, it, expect } from 'vitest';
import { linkedUserId, splitEmployeePhotos, applyEmployeePhotos } from './mac-photo-rules';
const store={users:[{id:'a',name:'Ana Silva',role:'colaborador'},{id:'b',name:'Rui',role:'colaborador'},{id:'c',name:'Rui',role:'gestor'}]};
describe('fotografias por ID',()=>{
  it('liga colaborador ao ID único',()=>expect(linkedUserId(store,'ana silva')).toBe('a'));
  it('nome repetido não recebe fotografia',()=>expect(linkedUserId(store,'Rui')).toBe(''));
  it('a fotografia mostrada não é regravada no documento',()=>{
    const base={employees:[{name:'Ana Silva',photo:'old'}]};
    const shown=applyEmployeePhotos(base,store,{a:'cloud'});
    const r=splitEmployeePhotos(shown,base,store,{a:'cloud'});
    expect(r.doc.employees[0].photo).toBe('old');expect(r.changes).toEqual({});
  });
  it('alteração real é enviada para o ID',()=>{
    const r=splitEmployeePhotos({employees:[{name:'Ana Silva',photo:'new'}]},{employees:[{name:'Ana Silva',photo:'old'}]},store,{a:'cloud'});
    expect(r.changes).toEqual({a:'new'});
  });
});
