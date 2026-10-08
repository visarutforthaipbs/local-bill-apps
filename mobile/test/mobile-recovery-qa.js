// Explicit DEBUG entry point; requires synthetic data and an isolated test bundle.
if(!DB.meta?.mobileSynthetic)throw Error('Recovery QA needs a synthetic profile');
const check=(v,label)=>{if(!v)throw Error(label);};
const phase=String(recoveryPhase),before=JSON.stringify(DB.documents);
async function fill(id,value){const input=document.getElementById(id);check(input,'Missing '+id);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));check(await mobileEditorRecovery.flush(),'Draft ACK '+id);}
if(phase==='write'){
 await closeModal();await openClientEditor();
 await fill('c_name','Synthetic recovered client');await fill('c_notes','  Thai ไทย raw unsaved notes  ');
 check(await closeModal(),'Client close ACK');
 await openRecurringEditor();await fill('r_proj','Synthetic recovered recurring');
 const inputs=document.querySelectorAll('#recItemsBody input');inputs[0].value='Synthetic repeating service';inputs[0].dispatchEvent(new Event('input',{bubbles:true}));
 inputs[3].value='1234.50';inputs[3].dispatchEvent(new Event('input',{bubbles:true}));
 check(await mobileEditorRecovery.flush(),'Recurring input ACK');check(await closeModal(),'Recurring close ACK');
 check(DB.clients.length===1&&DB.recurring.length===0,'Scratch not saved business records');
}else if(phase==='restore'){
 await openClientEditor();check(mobileEditorRecovery.state()?.pending,'Client recovery offered');check(mobileRestoreEditorDraft(),'Client restore');
 check(document.getElementById('c_notes').value==='  Thai ไทย raw unsaved notes  ','Client raw value survives restart');
 check(await saveClient(''),'Shared client DB save');check(DB.clients.length===2,'One recovered client');
 await openRecurringEditor();check(mobileEditorRecovery.state()?.pending,'Recurring recovery offered');check(mobileRestoreEditorDraft(),'Recurring restore');
 check(editRec.project==='Synthetic recovered recurring'&&String(editRec.items[0].price)==='1234.50','Recurring content survives restart');
 check(await saveRecurring(),'Shared recurring DB save');check(DB.recurring.length===1,'One recovered recurring');
}else if(phase==='check'){
 check(DB.clients.length===2&&DB.recurring.length===1,'Saved recovered records retained');
 await openClientEditor();check(!mobileEditorRecovery.state()?.pending,'Saved client draft not replayed');await closeModal();
 await openRecurringEditor();check(!mobileEditorRecovery.state()?.pending,'Saved recurring draft not replayed');await closeModal();
}else throw Error('Unknown recovery phase');
check(JSON.stringify(DB.documents)===before,'Financial and frozen documents unchanged');
setView('clients');
return {phase,clients:DB.clients.length,recurring:DB.recurring.length,financialDocumentsUnchanged:true,accessibility:await billingAPI.accessibilityStatus()};
