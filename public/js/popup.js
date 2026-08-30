const ctaBtn = document.querySelector('.google-suggest-cta');
const emojiMascot = document.querySelector('.emoji-mascot');
const emojiFace = document.querySelector('.emoji-face');
const emojiHand = document.querySelector('.emoji-hand');

document.addEventListener('mousemove', (e) => {
    if (!ctaBtn) return;

    const btnRect = ctaBtn.getBoundingClientRect();
    const btnCenterX = btnRect.left + btnRect.width / 2;
    const btnCenterY = btnRect.top + btnRect.height / 2;

    // Calcul de la distance du curseur au centre du bouton
    const distToBtn = Math.hypot(e.clientX - btnCenterX, e.clientY - btnCenterY);

    // Seuil d'activation à 100 pixels du bouton
    if (distToBtn < 100) {
        emojiFace.textContent = '😍';
        emojiHand.textContent = '👌';
        emojiMascot.classList.add('love');
    } else {
        emojiFace.textContent = '✌️';
        emojiHand.textContent = '😁';
        emojiMascot.classList.remove('love');
    }
});