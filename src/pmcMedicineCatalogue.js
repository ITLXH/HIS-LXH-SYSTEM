// Uses the existing HIS session; only the server holds the catalogue API credential.
export async function loadPmcMedicineCatalogue(authenticatedFetch){
 const response=await authenticatedFetch('/api/pmc/v1/medicines',{cache:'no-store'});
 if(!response.ok)throw Error('CATALOGUE_UNAVAILABLE');
 const catalogue=await response.json();
 if(catalogue.enabled===false)return null;
 if(catalogue.enabled!==true||typeof catalogue.version!=='string'||!Array.isArray(catalogue.items))throw Error('CATALOGUE_UNAVAILABLE');
 return catalogue.items.map(item=>({...item,catalogueVersion:catalogue.version}));
}
