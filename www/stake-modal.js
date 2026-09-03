// Coin-only matchmaking for embedded play.
(function () {
 let selectedStake=100;
 window.openStakeModal=function(){document.getElementById('stake-modal')?.classList.add('active');const b=window.currentUser?.coins||0,o=document.getElementById('modal-balance');if(o)o.textContent=b.toLocaleString();window.selectStake(document.querySelector('.stake-card.selected'),selectedStake);};
 window.closeStakeModal=function(){document.getElementById('stake-modal')?.classList.remove('active');};
 window.selectStake=function(el,stake){document.querySelectorAll('.stake-card').forEach(c=>c.classList.remove('selected'));el?.classList.add('selected');selectedStake=stake;const b=document.getElementById('btn-start-matchmaking');if(!b)return;const ok=(window.currentUser?.coins||0)>=stake;b.disabled=!ok;b.textContent=ok?'?? FIND MATCH':'? INSUFFICIENT COINS';};
 window.startMatchmaking=function(){window.location.href=`matchmaking.html?stake=${selectedStake}&currency=coins`;};
 document.addEventListener('click',e=>{if(e.target?.id==='stake-modal')window.closeStakeModal();});
})();
