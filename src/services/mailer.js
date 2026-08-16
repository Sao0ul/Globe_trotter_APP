const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Envoie le mail de confirmation de compte.
 *
 * @param {string} toEmail - destinataire
 * @param {string} username - pour personnaliser le message
 * @param {string} confirmationLink - lien de vérification déjà construit
 */
async function sendVerificationEmail(toEmail, username, confirmationLink) {
    const { error } = await resend.emails.send({
        from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
        to: toEmail,
        subject: 'confirm your Discover Cameroon account',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2>welcome ${username} 👋</h2>
        <p>click on this link bellow to confirm your account :</p>
        <a href="${confirmationLink}" style="display:inline-block; padding:12px 24px; background:#3b82f6; color:#fff; border-radius:8px; text-decoration:none;">
          confirm my account
        </a>
        <p style="color:#888; font-size:13px; margin-top:20px;">
          If you are not responsible of this mail; just ignore it.
        </p>
      </div>
    `,
    });

    if (error) {
        throw new Error(`Resend a refusé l'envoi : ${error.message}`);
    }
}

module.exports = { sendVerificationEmail };