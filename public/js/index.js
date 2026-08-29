const video = document.querySelector('.bg-video');
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
const isSlowConnection = connection && (
    connection.saveData ||
    ['slow-2g', '2g', '3g'].includes(connection.effectiveType)
);

if (isSmallScreen || isSlowConnection) {
    video.remove(); // garde juste le poster en <img> ou en background-image du body
} else {
    video.play().catch(() => { }); // autoplay peut être bloqué, on catch
}