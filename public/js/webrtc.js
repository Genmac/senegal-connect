window.SenegalWebRTC = (function () {
  let etatGlobal = null;
  let peer = null;
  let peerIdLocal = null;
  let connexionAppel = null;
  let streamLocal = null;
  let streamCamera = null;
  let appelId = null;
  let ticketIdAppel = null;
  let typeAppelCourant = null;
  let peerIdDistantEnAttente = null;
  let dureeChrono = 0;
  let intervalleChrono = null;
  let partageEcranActif = false;

  function $(id) { return document.getElementById(id); }

  function init(etat) {
    etatGlobal = etat;

    peer = new Peer(undefined, {
      host: window.location.hostname,
      port: window.location.port || (window.location.protocol === 'https:' ? 443 : 80),
      path: '/peerjs',
      secure: window.location.protocol === 'https:'
    });

    peer.on('open', (id) => { peerIdLocal = id; console.log('[PeerJS] peerId local :', id); });
    peer.on('error', (err) => console.error('[PeerJS] erreur :', err));

    peer.on('call', (appelEntrant) => {
      appelEntrant.answer(streamLocal);
      connexionAppel = appelEntrant;
      brancherEvenementsFlux(connexionAppel);
    });

    ecouterSocket();
  }

  function ecouterSocket() {
    const socket = etatGlobal.socket;

    socket.on('appel:entrant', (data) => {
      appelId = data.appelId;
      ticketIdAppel = data.ticketId;
      typeAppelCourant = data.type;
      peerIdDistantEnAttente = data.peerId;

      $('toast-appel-titre').textContent = `Appel ${data.type === 'video' ? 'vidéo' : 'audio'} entrant`;
      $('toast-appel-sous').textContent = `De la part de ${data.initiateur.nom}`;
      $('toast-appel-entrant').classList.add('visible');
    });

    socket.on('appel:initie_ok', (data) => { appelId = data.appelId; });

    socket.on('appel:accepte', async (data) => {
      peerIdDistantEnAttente = data.peerId;
      await ouvrirOverlayAppel();
      connexionAppel = peer.call(peerIdDistantEnAttente, streamLocal);
      brancherEvenementsFlux(connexionAppel);
      demarrerChrono();
    });

    socket.on('appel:refuse', () => { toast('Appel refusé par le destinataire.'); reinitialiserAppel(); });
    socket.on('appel:termine', () => { toast('Appel terminé.'); fermerOverlayAppel(); });
    socket.on('appel:erreur', (err) => { toast('⚠️ ' + err.message); reinitialiserAppel(); });

    socket.on('appel:controle', (data) => {
      $('etat-micro-distant').classList.toggle('visible', data.micro === false);
      $('etat-video-distant').classList.toggle('visible', data.video === false);
      $('badge-partage').classList.toggle('visible', data.partageEcran === true);
    });
  }

  function toast(msg) {
    const t = document.getElementById('toast-notif');
    t.textContent = msg;
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), 3500);
  }

  async function initierAppel(ticketId, type) {
    ticketIdAppel = ticketId;
    typeAppelCourant = type;

    try {
      streamLocal = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
    } catch (err) {
      toast("Impossible d'accéder au micro/caméra : " + err.message);
      return;
    }
    if (!peerIdLocal) { toast('Connexion PeerJS pas encore prête, réessayez.'); return; }

    etatGlobal.socket.emit('appel:initier', { ticketId, type, peerId: peerIdLocal });
    await ouvrirOverlayAppel();
  }

  $('btn-accepter-appel').addEventListener('click', async () => {
    $('toast-appel-entrant').classList.remove('visible');
    try {
      streamLocal = await navigator.mediaDevices.getUserMedia({ audio: true, video: typeAppelCourant === 'video' });
    } catch (err) {
      toast("Impossible d'accéder au micro/caméra : " + err.message);
      return;
    }
    await ouvrirOverlayAppel();
    etatGlobal.socket.emit('appel:accepter', { appelId, peerId: peerIdLocal });
    demarrerChrono();
  });

  $('btn-refuser-appel').addEventListener('click', () => {
    $('toast-appel-entrant').classList.remove('visible');
    etatGlobal.socket.emit('appel:refuser', { appelId });
    reinitialiserAppel();
  });

  async function ouvrirOverlayAppel() {
    $('video-locale').srcObject = streamLocal;
    $('video-locale').style.display = typeAppelCourant === 'video' ? 'block' : 'none';
    streamCamera = streamLocal;
    $('overlay-appel').classList.add('visible');
    $('etat-micro-distant').classList.remove('visible');
    $('etat-video-distant').classList.remove('visible');
    $('badge-partage').classList.remove('visible');
  }

  function brancherEvenementsFlux(appelPeer) {
    appelPeer.on('stream', (fluxDistant) => { $('video-distante').srcObject = fluxDistant; });
    appelPeer.on('close', () => fermerOverlayAppel());
    appelPeer.on('error', (err) => console.error('[PeerJS appel] erreur :', err));
  }

  function fermerOverlayAppel() {
    $('overlay-appel').classList.remove('visible');
    arreterChrono();
    if (streamLocal) streamLocal.getTracks().forEach((t) => t.stop());
    if (connexionAppel) { try { connexionAppel.close(); } catch (e) {} }
    reinitialiserAppel();
  }

  function reinitialiserAppel() {
    appelId = null; ticketIdAppel = null; typeAppelCourant = null;
    peerIdDistantEnAttente = null; connexionAppel = null;
    streamLocal = null; streamCamera = null; partageEcranActif = false;
    $('btn-toggle-partage').classList.remove('actif');
    $('video-locale').srcObject = null;
    $('video-distante').srcObject = null;
  }

  $('btn-toggle-micro').addEventListener('click', () => {
    if (!streamLocal) return;
    const track = streamLocal.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    $('btn-toggle-micro').classList.toggle('actif', track.enabled);
    $('btn-toggle-micro').classList.toggle('coupe', !track.enabled);
    envoyerEtatControle();
  });

  $('btn-toggle-camera').addEventListener('click', () => {
    if (!streamLocal) return;
    const track = streamLocal.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    $('btn-toggle-camera').classList.toggle('actif', track.enabled);
    $('btn-toggle-camera').classList.toggle('coupe', !track.enabled);
    envoyerEtatControle();
  });

  $('btn-toggle-partage').addEventListener('click', async () => {
    if (!connexionAppel) return;
    if (!partageEcranActif) {
      try {
        const streamEcran = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
        const pisteEcran = streamEcran.getVideoTracks()[0];
        const sender = connexionAppel.peerConnection?.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(pisteEcran);
        $('video-locale').srcObject = streamEcran;
        partageEcranActif = true;
        $('btn-toggle-partage').classList.add('actif');
        envoyerEtatControle();
        pisteEcran.onended = async () => revenirCamera(sender);
      } catch (err) { console.log("Partage d'écran annulé :", err.message); }
    } else {
      const sender = connexionAppel.peerConnection?.getSenders().find((s) => s.track?.kind === 'video');
      await revenirCamera(sender);
    }
  });

  async function revenirCamera(sender) {
    if (streamCamera && sender) {
      const pisteCamera = streamCamera.getVideoTracks()[0];
      if (pisteCamera) await sender.replaceTrack(pisteCamera);
    }
    $('video-locale').srcObject = streamCamera;
    partageEcranActif = false;
    $('btn-toggle-partage').classList.remove('actif');
    envoyerEtatControle();
  }

  function envoyerEtatControle() {
    if (!ticketIdAppel) return;
    const micro = streamLocal?.getAudioTracks()[0]?.enabled ?? true;
    const video = streamLocal?.getVideoTracks()[0]?.enabled ?? true;
    etatGlobal.socket.emit('appel:controle', { ticketId: ticketIdAppel, micro, video, partageEcran: partageEcranActif });
  }

  $('btn-raccrocher').addEventListener('click', () => {
    if (appelId) etatGlobal.socket.emit('appel:terminer', { appelId, dureeSecondes: dureeChrono });
    fermerOverlayAppel();
  });

  function demarrerChrono() {
    dureeChrono = 0;
    $('chrono-appel').textContent = '00:00';
    intervalleChrono = setInterval(() => {
      dureeChrono++;
      const min = String(Math.floor(dureeChrono / 60)).padStart(2, '0');
      const sec = String(dureeChrono % 60).padStart(2, '0');
      $('chrono-appel').textContent = `${min}:${sec}`;
    }, 1000);
  }

  function arreterChrono() { clearInterval(intervalleChrono); intervalleChrono = null; }

  return { init, initierAppel };
})();
