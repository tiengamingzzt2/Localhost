const emailDrafts=new Map();
let openEmailKey=null;
const emailDialog=document.querySelector('#emailDialog');
function resetEmailDrafts(){
  if(emailDialog.open)emailDialog.close();
  emailDrafts.clear();openEmailKey=null;
}
function buildContractEmail(row,{tone='formal',length='standard',includePrice=true,thanks=false,reply=false,extra=''}={}){
  const customer=row.customer_name || row.customer_id || 'Quý khách hàng';
  const contract=row.contract_id && row.contract_id!=='—'?`hợp đồng ${row.contract_id}`:'hợp đồng dịch vụ';
  const plan=row.plan && row.plan!=='Chưa có dữ liệu'?`gói ${row.plan}`:'gói dịch vụ hiện tại';
  const expiration=row.expiration_date || 'chưa có ngày hết hạn xác thực';
  const group=reviewGroup(row),friendly=tone==='friendly';
  const subject=group==='blocked'?`Cập nhật hỗ trợ và ${contract} · ${customer}`:group==='verify'?`Đối chiếu thông tin ${contract} · ${customer}`:`Trao đổi gia hạn ${contract} · ${customer}`;
  const greeting=friendly?`Chào anh/chị đại diện ${customer},`:`Kính gửi Quý đại diện ${customer},`;
  const opening=friendly?'An Tín cảm ơn anh/chị đã đồng hành cùng dịch vụ.':'An Tín trân trọng cảm ơn Quý công ty đã sử dụng dịch vụ của chúng tôi.';
  const facts=`${contract.charAt(0).toUpperCase()+contract.slice(1)} đang sử dụng ${plan}, ngày hết hạn ghi nhận là ${expiration}.`;
  let main,action;
  if(group==='blocked'){
    const tickets=Number.isFinite(row.open_tickets) && row.open_tickets>0?`${row.open_tickets} ticket hỗ trợ đang mở`:'vấn đề hỗ trợ cần được xác minh và xử lý';
    main=`Dữ liệu đối chiếu hiện ghi nhận ${tickets}. Chúng tôi xin ghi nhận những bất tiện Quý công ty đang gặp phải và ưu tiên phối hợp xử lý sự cố trước khi trao đổi thay đổi gói dịch vụ.`;
    action='Kính mong Quý công ty cập nhật tình trạng sự cố và đầu mối phụ trách để hai bên tiếp tục phối hợp xử lý.';
  }else if(group==='verify'){
    const missing=[];
    if(row.adoption_rate==null)missing.push('mức sử dụng');
    if(row.open_tickets==null)missing.push('tình trạng ticket hỗ trợ');
    if(row.renewal_value==null)missing.push('giá trị gia hạn');
    main=`Thông tin ${missing.length?missing.join(', '):'nghiệp vụ'} cần được đối chiếu thêm trước khi hoàn tất đề xuất gia hạn.`;
    action='Kính mong Quý công ty xác nhận các thông tin còn thiếu và đầu mối liên hệ để chúng tôi chuẩn bị phương án phù hợp.';
  }else if(group==='upgrade'){
    main=`Mức sử dụng ghi nhận là ${row.adoption_rate}%; tại thời điểm đối chiếu chưa ghi nhận ticket đang mở. Chúng tôi đề nghị trao đổi về nhu cầu sử dụng và khả năng nâng gói, sau khi hai bên xác nhận phương án phù hợp.`;
    action='Kính mong Quý công ty phản hồi nhu cầu sử dụng và thời gian thuận tiện để trao đổi phương án gia hạn.';
  }else{
    main='Chúng tôi đề xuất trao đổi việc gia hạn gói hiện tại để Quý công ty chủ động kế hoạch sử dụng trong kỳ tiếp theo.';
    action='Kính mong Quý công ty phản hồi nhu cầu gia hạn và thời gian thuận tiện để trao đổi chi tiết.';
  }
  const paragraphs=[greeting];
  if(length!=='short' || thanks)paragraphs.push(opening);
  paragraphs.push(facts);
  if(length==='short'){
    paragraphs.push(group==='blocked'?'Chúng tôi ưu tiên đối chiếu và xử lý các sự cố hỗ trợ trước khi trao đổi thay đổi gói.':group==='verify'?main:group==='upgrade'?`Mức sử dụng ${row.adoption_rate}%, chưa ghi nhận ticket mở. Chúng tôi mong trao đổi nhu cầu gia hạn và khả năng nâng gói.`:'Chúng tôi mong trao đổi việc gia hạn gói hiện tại cùng Quý công ty.');
  }else paragraphs.push(main);
  if(includePrice && Number.isFinite(row.renewal_value))paragraphs.push(`Giá trị gia hạn tham khảo theo dữ liệu hiện có: ${money(row.renewal_value)}. Mức giá và chính sách cần được xác nhận trước khi chốt.`);
  if(length==='detailed')paragraphs.push(`Để chuẩn bị trao đổi, hai bên cần xác nhận nhu cầu sử dụng, tình trạng hỗ trợ và chính sách áp dụng cho ${contract}.`);
  if(length!=='short' || reply)paragraphs.push(friendly?action.replace('Kính mong Quý công ty','Mong anh/chị'):action);
  else paragraphs.push(friendly?'Anh/chị cho An Tín biết thời gian thuận tiện để trao đổi nhé.':'Kính mong Quý công ty phản hồi để hai bên tiếp tục trao đổi.');
  if(extra.trim())paragraphs.push(extra.trim());
  paragraphs.push(friendly?'Cảm ơn anh/chị,\nĐội ngũ An Tín':'Trân trọng,\nĐội ngũ An Tín');
  return {subject,body:paragraphs.join('\n\n')};
}
function emailDraftFor(row){
  const key=reviewKey(row);
  if(!emailDrafts.has(key))emailDrafts.set(key,{...buildContractEmail(row),tone:'formal',length:'standard',includePrice:true,instruction:'',previous:null});
  return emailDrafts.get(key);
}
function parseEmailInstruction(raw){
  let rest=String(raw || '').trim(),extra='';const options={};
  const addition=rest.match(/(?:thêm câu|them cau|bổ sung câu|bo sung cau)\s*:\s*([\s\S]+)$/i);
  if(addition){extra=addition[1].trim();rest=rest.slice(0,addition.index);}
  rest=searchKey(rest);
  const rules=[
    [/\b(?:khong|bo|an)\s+(?:(?:nhac|neu|de cap|hien thi)\s+)?(?:den\s+)?(?:gia tri gia han|gia tri|gia|so tien)\b/g,{includePrice:false}],
    [/\b(?:co|them|hien|neu|nhac)\s+(?:(?:nhac|neu|hien thi)\s+)?(?:gia tri gia han|gia tri|gia|so tien)\b/g,{includePrice:true}],
    [/\b(?:ngan gon|rut gon|ngan hon|ngan lai|viet ngan)\b/g,{length:'short'}],
    [/\b(?:chi tiet|day du hon|dai hon)\b/g,{length:'detailed'}],
    [/\b(?:vua phai|do dai vua)\b/g,{length:'standard'}],
    [/\b(?:trang trong|chuyen nghiep|lich su)\b/g,{tone:'formal'}],
    [/\b(?:than thien|gan gui|tu nhien)\b/g,{tone:'friendly'}],
    [/\b(?:them loi cam on|cam on)\b/g,{thanks:true}],
    [/\b(?:them loi de nghi phan hoi|de nghi phan hoi|them loi moi phan hoi)\b/g,{reply:true}]
  ];
  for(const [pattern,values] of rules)rest=rest.replace(pattern,()=>{Object.assign(options,values);return ' ';});
  rest=rest.replace(/\b(?:hay|giup|toi|minh|viet|lai|email|mail|noi dung|hon|va|nhe|vui long|cho)\b/g,' ').replace(/[\s,;.!:–-]+/g,' ').trim();
  return {options:{...options,extra},unsupported:rest};
}
function saveOpenEmail(){
  const draft=emailDrafts.get(openEmailKey);if(!draft)return;
  draft.subject=document.querySelector('#emailSubject').value;
  draft.body=document.querySelector('#emailBody').value;
  draft.instruction=document.querySelector('#emailInstruction').value;
  draft.tone=document.querySelector('#emailTone').value;
  draft.length=document.querySelector('#emailLength').value;
  draft.includePrice=document.querySelector('#emailIncludePrice').checked;
  document.querySelectorAll('[data-email-preview-key]').forEach(node=>{if(node.dataset.emailPreviewKey===openEmailKey)node.textContent=draft.body;});
}
function displayEmailDraft(draft){
  document.querySelector('#emailSubject').value=draft.subject;
  document.querySelector('#emailBody').value=draft.body;
  document.querySelector('#emailTone').value=draft.tone;
  document.querySelector('#emailLength').value=draft.length;
  document.querySelector('#emailIncludePrice').checked=draft.includePrice;
  document.querySelector('#emailInstruction').value=draft.instruction;
  document.querySelector('#undoEmailRewrite').disabled=!draft.previous;
}
function openContractEmail(key){
  if(state.processing || state.uploading)return false;
  const row=state.analysis?.rows.find(r=>reviewKey(r)===key);if(!row)return false;
  if(emailDialog.open)saveOpenEmail();
  openEmailKey=key;const draft=emailDraftFor(row);
  document.querySelector('#emailContractContext').textContent=`${row.customer_name || row.customer_id} · Mã khách: ${row.customer_id} · Hợp đồng: ${row.contract_id || 'Chưa có mã'}`;
  displayEmailDraft(draft);document.querySelector('#emailDialogStatus').textContent='Bạn có thể chỉnh trực tiếp tiêu đề và nội dung.';
  if(!emailDialog.open)emailDialog.showModal();
  return true;
}
function rewriteContractEmail(){
  saveOpenEmail();const draft=emailDrafts.get(openEmailKey),row=state.analysis?.rows.find(r=>reviewKey(r)===openEmailKey);
  if(!draft || !row || state.processing)return false;
  const parsed=parseEmailInstruction(draft.instruction);
  if(parsed.unsupported){document.querySelector('#emailDialogStatus').textContent=`Chưa hỗ trợ yêu cầu “${parsed.unsupported}”. Chọn giọng văn/độ dài, yêu cầu ẩn giá hoặc dùng “Thêm câu: …”. Bản hiện tại được giữ lại.`;return false;}
  const options={tone:draft.tone,length:draft.length,includePrice:draft.includePrice,...parsed.options};
  draft.previous={subject:draft.subject,body:draft.body,tone:draft.tone,length:draft.length,includePrice:draft.includePrice,instruction:draft.instruction};
  Object.assign(draft,options,buildContractEmail(row,options));displayEmailDraft(draft);saveOpenEmail();
  document.querySelector('#emailDialogStatus').textContent='Đã viết lại bản nháp. Hãy xem lại trước khi sao chép; có thể hoàn tác.';
  return true;
}
function undoContractEmail(){
  const draft=emailDrafts.get(openEmailKey);if(!draft?.previous)return;
  Object.assign(draft,draft.previous,{previous:null});displayEmailDraft(draft);saveOpenEmail();
  document.querySelector('#emailDialogStatus').textContent='Đã khôi phục bản trước khi viết lại.';
}
async function copyOpenEmail(){
  saveOpenEmail();const draft=emailDrafts.get(openEmailKey);if(!draft)return false;
  if(!draft.subject.trim() || !draft.body.trim()){document.querySelector('#emailDialogStatus').textContent='Bổ sung tiêu đề và nội dung trước khi sao chép.';return false;}
  const button=document.querySelector('#copyEmailDraft');button.disabled=true;
  try{
    const copied=await window.copyToClipboard(`Tiêu đề: ${draft.subject.trim()}\n\n${draft.body.trim()}`,'Đã sao chép email.');
    document.querySelector('#emailDialogStatus').textContent=copied?'Đã sao chép tiêu đề và nội dung email.':'Chưa sao chép được. Bạn có thể chọn nội dung và sao chép thủ công.';
    return copied;
  }catch{document.querySelector('#emailDialogStatus').textContent='Chưa sao chép được. Vui lòng thử lại hoặc sao chép thủ công.';return false;}
  finally{button.disabled=false;}
}
document.querySelector('#closeEmailDialog').onclick=()=>emailDialog.close();
document.querySelector('#rewriteEmail').onclick=rewriteContractEmail;
document.querySelector('#undoEmailRewrite').onclick=undoContractEmail;
document.querySelector('#copyEmailDraft').onclick=copyOpenEmail;
emailDialog.addEventListener('input',saveOpenEmail);
emailDialog.addEventListener('change',saveOpenEmail);
emailDialog.addEventListener('close',saveOpenEmail);
