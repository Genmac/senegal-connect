// ==================== ÉTAT GLOBAL ====================
const API_BASE = window.location.origin;
let etat = {
  token: null,
  utilisateur: null,
  socket: null,
  ticketActif: null,
  tickets: [],
  minuteurEffacementFrappe: null
};

const EMOJIS = ['😀','😂','😍','👍','🙏','🎉','😢','😡','🤔','👏','🔥','❤️',
                '✅','❌','⏰','📄','💰','📱','😴','🙌','👋','💪','😅','🤝'];
const EMOJIS_REACTION = ['👍','❤️','😂','😮','😢','🙏'];

function $(id) { return document.getElementById(id); }

function afficherToast(message, duree = 3500) {
  const toast = $('toast-notif');
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), duree);
}

function formatHeure(dateStr) {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatTaille(octets) {
  if (!octets) return '';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

function echapperHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function appelApi(chemin, options = {}) {
  const res = await fetch(API_BASE + chemin, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(etat.token ? { 'Authorization': `Bearer ${etat.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.erreur || data.erreurs?.[0]?.message || 'Erreur API');
  return data;
}

// ==================== CONNEXION ====================
$('btn-login').addEventListener('click', connecter);
$('login-mdp').addEventListener('keydown', (e) => { if (e.key === 'Enter') connecter(); });

async function connecter() {
  const email = $('login-email').value.trim();
  const mot_de_passe = $('login-mdp').value;
  const erreurDiv = $('erreur-login');
  erreurDiv.textContent = '';

  if (!email || !mot_de_passe) {
    erreurDiv.textContent = 'Email et mot de passe requis.';
    return;
  }

  try {
    const data = await appelApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, mot_de_passe })
    });
    etat.token = data.token;
    etat.utilisateur = data.utilisateur;
    demarrerApplication();
  } catch (err) {
    erreurDiv.textContent = err.message || 'Identifiants incorrects.';
  }
}

$('btn-deconnexion').addEventListener('click', () => {
  if (etat.socket) etat.socket.disconnect();
  etat = { token: null, utilisateur: null, socket: null, ticketActif: null, tickets: [] };
  $('app').classList.remove('visible');
  $('ecran-login').style.display = 'flex';
  $('login-mdp').value = '';
});

function demarrerApplication() {
  $('ecran-login').style.display = 'none';
  $('app').classList.add('visible');
  $('badge-role').textContent = etat.utilisateur.role;
  $('bloc-creation-ticket').style.display = etat.utilisateur.role === 'client' ? 'block' : 'none';

  connecterSocket();
  chargerTickets();

  if (window.SenegalWebRTC) window.SenegalWebRTC.init(etat);
}

// ==================== SOCKET.IO ====================
function connecterSocket() {
  etat.socket = io(API_BASE, { auth: { token: etat.token } });

  etat.socket.on('connect_error', (err) => {
    afficherToast('Connexion temps réel échouée : ' + err.message);
  });

  etat.socket.on('receive_message', (msg) => {
    if (etat.ticketActif && msg.ticket_id === etat.ticketActif.id) {
      ajouterMessageAuFil(msg);
      scrollerMessagesEnBas();
      if (msg.expediteur.id !== etat.utilisateur.id) {
        etat.socket.emit('message:lu', { ticket_id: etat.ticketActif.id });
      }
    }
    $('indicateur-frappe').textContent = '';
  });

  etat.socket.on('message:statut', (data) => {
    const bulle = document.querySelector(`[data-message-id="${data.message_id}"] .ticks`);
    if (bulle) { bulle.textContent = '✓✓'; bulle.classList.add('lu'); }
  });

  etat.socket.on('reaction:maj', (data) => {
    afficherReactionsSurMessage(data.message_id, data.reactions);
  });

  etat.socket.on('frappe', (data) => {
    if (!etat.ticketActif) return;
    $('indicateur-frappe').textContent = `${data.nom} est en train d'écrire…`;
    clearTimeout(etat.minuteurEffacementFrappe);
    etat.minuteurEffacementFrappe = setTimeout(() => { $('indicateur-frappe').textContent = ''; }, 2500);
  });

  etat.socket.on('ticket:nouveau', (ticket) => {
    afficherToast(`🔔 Nouveau ticket : ${ticket.sujet}`);
    chargerTickets();
  });

  etat.socket.on('ticket:pris_en_charge', (data) => {
    afficherToast(`Votre ticket a été pris en charge par ${data.agent.nom}`);
    chargerTickets();
    if (etat.ticketActif?.id === data.ticket_id) ouvrirTicket(data.ticket_id);
  });

  etat.socket.on('ticket:assigne_ok', () => {
    chargerTickets();
    if (etat.ticketActif) ouvrirTicket(etat.ticketActif.id);
  });

  etat.socket.on('ticket:ferme', (data) => {
    afficherToast('Le ticket a été fermé.');
    chargerTickets();
    if (etat.ticketActif?.id === data.ticket_id) ouvrirTicket(data.ticket_id);
  });

  etat.socket.on('error_message', (err) => afficherToast('⚠️ ' + err.message));
}

// ==================== TICKETS ====================
async function chargerTickets() {
  try {
    const data = await appelApi('/api/tickets');
    etat.tickets = data.tickets;
    afficherListeTickets();
  } catch (err) { console.error(err); }
}

function afficherListeTickets() {
  const conteneur = $('liste-tickets');
  if (etat.tickets.length === 0) {
    conteneur.innerHTML = '<div class="vide">Aucun ticket pour le moment.</div>';
    return;
  }
  conteneur.innerHTML = '';
  etat.tickets.forEach((ticket) => {
    const div = document.createElement('div');
    div.className = 'item-ticket' + (etat.ticketActif?.id === ticket.id ? ' actif' : '');
    const nomAffiche = etat.utilisateur.role === 'client'
      ? (ticket.agent_nom ? `Agent : ${ticket.agent_nom}` : "En attente d'un agent")
      : (ticket.client_nom ? `${ticket.client_prenom} ${ticket.client_nom}` : '');

    div.innerHTML = `
      <div class="item-sujet">${echapperHtml(ticket.sujet)}</div>
      <div class="item-meta">
        <span>${echapperHtml(nomAffiche)}</span>
        <span class="statut-pill statut-${ticket.statut}">${ticket.statut.replace('_', ' ')}</span>
      </div>`;
    div.addEventListener('click', () => ouvrirTicket(ticket.id));
    conteneur.appendChild(div);
  });
}

$('btn-creer-ticket').addEventListener('click', async () => {
  const sujet = $('nouveau-sujet').value.trim();
  if (!sujet) return;
  try {
    const data = await appelApi('/api/tickets', { method: 'POST', body: JSON.stringify({ sujet }) });
    $('nouveau-sujet').value = '';
    await chargerTickets();
    ouvrirTicket(data.ticket.id);
  } catch (err) { afficherToast('Erreur : ' + err.message); }
});

async function ouvrirTicket(ticketId) {
  if (!etat.tickets.find((t) => t.id === ticketId)) await chargerTickets();
  etat.ticketActif = etat.tickets.find((t) => t.id === ticketId);
  if (!etat.ticketActif) return;

  etat.socket.emit('join_room', { ticket_id: ticketId });

  $('zone-vide-panneau').style.display = 'none';
  $('fil-actif').style.display = 'flex';
  $('pastille-connexion').classList.add('connecte');
  $('fil-sujet').textContent = etat.ticketActif.sujet;
  $('fil-sous').textContent = `Ticket #${etat.ticketActif.id} · ${etat.ticketActif.statut.replace('_', ' ')}`;

  construireActionsHeader();
  afficherListeTickets();

  $('zone-messages').innerHTML = '';
  try {
    const data = await appelApi(`/api/tickets/${ticketId}/messages`);
    data.messages.forEach(ajouterMessageAuFil);
    scrollerMessagesEnBas();
    etat.socket.emit('message:lu', { ticket_id: ticketId });
  } catch (err) { console.error(err); }

  const appelPossible = etat.ticketActif.statut === 'en_cours';
  $('btn-appel-audio').disabled = !appelPossible;
  $('btn-appel-video').disabled = !appelPossible;
}

function construireActionsHeader() {
  const actions = $('fil-actions');
  actions.innerHTML = '';
  const ticket = etat.ticketActif;
  const role = etat.utilisateur.role;

  if (role === 'agent' && ticket.statut === 'ouvert') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-accent btn-sm';
    btn.textContent = "S'assigner ce ticket";
    btn.addEventListener('click', () => etat.socket.emit('ticket:assigner', { ticket_id: ticket.id }));
    actions.appendChild(btn);
  }
  if (role === 'agent' && ticket.statut === 'en_cours') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost btn-sm';
    btn.textContent = 'Fermer le ticket';
    btn.addEventListener('click', () => etat.socket.emit('ticket:fermer', { ticket_id: ticket.id }));
    actions.appendChild(btn);
  }
}

// ==================== MESSAGES ====================
function ajouterMessageAuFil(msg) {
  const zone = $('zone-messages');
  const estMoi = (msg.expediteur?.id || msg.expediteur_id) === etat.utilisateur.id;
  const nom = msg.expediteur?.nom || msg.nom || '—';

  const ligne = document.createElement('div');
  ligne.className = 'ligne-message ' + (estMoi ? 'moi' : 'autre');
  ligne.style.position = 'relative';
  ligne.dataset.messageId = msg.id;

  const bulle = document.createElement('div');
  bulle.className = 'bulle ' + (estMoi ? 'bulle-moi' : 'bulle-autre');

  let corpsHtml = '';
  if (!estMoi) corpsHtml += `<div class="bulle-nom">${echapperHtml(nom)}</div>`;

  if (msg.type === 'texte') {
    corpsHtml += `<div>${echapperHtml(msg.contenu)}</div>`;
  } else if (msg.type === 'image') {
    corpsHtml += `<a href="${msg.fichier_url}" target="_blank"><img class="image-message" src="${msg.fichier_url}" alt="${echapperHtml(msg.fichier_nom)}"></a>`;
  } else if (msg.type === 'audio') {
    corpsHtml += `<audio class="audio-message" controls src="${msg.fichier_url}"></audio>`;
  } else if (msg.type === 'fichier') {
    corpsHtml += `
      <a class="carte-fichier" href="${msg.fichier_url}" target="_blank">
        <span class="icone-fichier">📄</span>
        <div class="infos-fichier">
          <span class="nom-fichier">${echapperHtml(msg.fichier_nom)}</span>
          <span class="taille-fichier">${formatTaille(msg.fichier_taille)}</span>
        </div>
      </a>`;
  }

  const ticksHtml = estMoi ? `<span class="ticks">✓</span>` : '';
  corpsHtml += `<div class="meta-msg">${formatHeure(msg.envoye_le)} ${ticksHtml}</div>`;
  bulle.innerHTML = corpsHtml;

  const btnReagir = document.createElement('button');
  btnReagir.className = 'btn-reagir';
  btnReagir.textContent = '🙂+';
  btnReagir.addEventListener('click', (e) => ouvrirMiniPickerReaction(e, msg.id));

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'flex-end';
  wrapper.style.gap = '4px';
  wrapper.style.flexDirection = estMoi ? 'row-reverse' : 'row';
  wrapper.appendChild(bulle);
  wrapper.appendChild(btnReagir);

  ligne.appendChild(wrapper);

  const reacDiv = document.createElement('div');
  reacDiv.className = 'reactions-conteneur';
  reacDiv.id = `reactions-${msg.id}`;
  ligne.appendChild(reacDiv);

  zone.appendChild(ligne);
}

function ouvrirMiniPickerReaction(e, messageId) {
  document.querySelectorAll('.mini-picker-reaction').forEach((el) => el.remove());
  const picker = document.createElement('div');
  picker.className = 'mini-picker-reaction visible';
  EMOJIS_REACTION.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      etat.socket.emit('reaction:toggle', { message_id: messageId, ticket_id: etat.ticketActif.id, emoji });
      picker.remove();
    });
    picker.appendChild(btn);
  });
  e.target.parentElement.style.position = 'relative';
  e.target.parentElement.appendChild(picker);
  setTimeout(() => {
    document.addEventListener('click', function fermer(ev) {
      if (!picker.contains(ev.target)) { picker.remove(); document.removeEventListener('click', fermer); }
    });
  }, 0);
}

function afficherReactionsSurMessage(messageId, reactions) {
  const conteneur = $(`reactions-${messageId}`);
  if (!conteneur) return;
  conteneur.innerHTML = '';
  reactions.forEach((r) => {
    if (r.total === 0) return;
    const chip = document.createElement('div');
    const jaiReagi = r.utilisateurs.includes(etat.utilisateur.id);
    chip.className = 'reaction-chip' + (jaiReagi ? ' moi' : '');
    chip.textContent = `${r.emoji} ${r.total}`;
    chip.addEventListener('click', () => {
      etat.socket.emit('reaction:toggle', { message_id: messageId, ticket_id: etat.ticketActif.id, emoji: r.emoji });
    });
    conteneur.appendChild(chip);
  });
}

function scrollerMessagesEnBas() {
  const zone = $('zone-messages');
  zone.scrollTop = zone.scrollHeight;
}

function envoyerMessage() {
  const input = $('input-message');
  const contenu = input.value.trim();
  if (!contenu || !etat.ticketActif) return;
  etat.socket.emit('send_message', { ticket_id: etat.ticketActif.id, contenu });
  input.value = '';
  fermerPanneauEmoji();
}

$('btn-envoyer').addEventListener('click', envoyerMessage);
$('input-message').addEventListener('keydown', (e) => { if (e.key === 'Enter') envoyerMessage(); });

let dernierEnvoiFrappe = 0;
$('input-message').addEventListener('input', () => {
  if (!etat.ticketActif) return;
  const maintenant = Date.now();
  if (maintenant - dernierEnvoiFrappe > 1000) {
    etat.socket.emit('frappe', { ticket_id: etat.ticketActif.id });
    dernierEnvoiFrappe = maintenant;
  }
});

// ==================== ÉMOJIS (message) ====================
function construirePanneauEmoji() {
  const panneau = $('panneau-emoji');
  panneau.innerHTML = '';
  EMOJIS.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      etat.socket.emit('send_message', { ticket_id: etat.ticketActif.id, contenu: emoji });
      fermerPanneauEmoji();
    });
    panneau.appendChild(btn);
  });
}
construirePanneauEmoji();
function fermerPanneauEmoji() { $('panneau-emoji').classList.remove('visible'); }
$('btn-emoji').addEventListener('click', (e) => { e.stopPropagation(); $('panneau-emoji').classList.toggle('visible'); });
document.addEventListener('click', (e) => {
  if (!$('panneau-emoji').contains(e.target) && e.target.id !== 'btn-emoji') fermerPanneauEmoji();
});

// ==================== PARTAGE DE FICHIER ====================
$('btn-fichier').addEventListener('click', () => $('input-fichier').click());

$('input-fichier').addEventListener('change', async (e) => {
  const fichier = e.target.files[0];
  if (!fichier || !etat.ticketActif) return;

  const formData = new FormData();
  formData.append('fichier', fichier);

  try {
    const data = await appelApi(`/api/tickets/${etat.ticketActif.id}/fichier`, {
      method: 'POST',
      body: formData
    });
    etat.socket.emit('fichier:partager', {
      ticket_id: etat.ticketActif.id,
      fichier_url: data.fichier_url,
      fichier_nom: data.fichier_nom,
      fichier_taille: data.fichier_taille,
      mime_type: data.mime_type
    });
  } catch (err) {
    afficherToast('Erreur upload : ' + err.message);
  }
  e.target.value = '';
});

// ==================== APPELS ====================
$('btn-appel-audio').addEventListener('click', () => {
  if (window.SenegalWebRTC && etat.ticketActif) window.SenegalWebRTC.initierAppel(etat.ticketActif.id, 'audio');
});
$('btn-appel-video').addEventListener('click', () => {
  if (window.SenegalWebRTC && etat.ticketActif) window.SenegalWebRTC.initierAppel(etat.ticketActif.id, 'video');
});
