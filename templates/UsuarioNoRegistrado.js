// services/emailService.js

const transporter = require('../config/mailer'); // ⚠️ Ajusta esta ruta si tu archivo mailer.js está en otra ubicación relativa.

/**
 * Envía un correo electrónico de bienvenida a un nuevo usuario con sus credenciales.
 * @param {string} destinatarioCorreo - La dirección de correo electrónico del usuario.
 * @param {string} contrasenaGenerada - La contraseña generada automáticamente para el usuario.
 * @returns {Promise<boolean>} - `true` si el correo se envió con éxito, `false` en caso contrario.
 */
async function enviarCorreoBienvenida(destinatarioCorreo, contrasenaGenerada) {
    const mailOptions = {
        from: `Accesorios Apolo <${process.env.EMAIL_USER}>`, // Usamos la variable de entorno para el remitente
        to: destinatarioCorreo, // Correo del destinatario
        subject: '¡Bienvenido a Accesorios Apolo y tus credenciales de acceso!', // Asunto del correo
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #4CAF50;">¡Hola! ¡Bienvenido a Accesorios Apolo!</h2>
                <p>Nos emociona tenerte como parte de nuestra comunidad. ¡Gracias por registrarte y por tu reciente compra!</p>
                <p>Queremos que tengas acceso fácil a tu cuenta para futuras compras y para gestionar tus pedidos. Aquí están tus credenciales de inicio de sesión:</p>
                <p style="background-color: #f4f4f4; padding: 15px; border-left: 5px solid #4CAF50; margin: 20px 0;">
                    <strong>Correo:</strong> <span style="color: #007BFF;">${destinatarioCorreo}</span><br>
                    <strong>Contraseña:</strong> <span style="color: #dc3545;">${contrasenaGenerada}</span>
                </p>
                <p>Te recomendamos encarecidamente cambiar tu contraseña por una que solo tú conozcas, una vez que inicies sesión por primera vez. Esto es por tu seguridad.</p>
                <p>Puedes iniciar sesión en tu cuenta haciendo clic en el siguiente enlace:</p>
                <p style="text-align: center;">
                    <a href="[URL_DE_TU_PAGINA_DE_INICIO_DE_SESION]" style="display: inline-block; padding: 10px 20px; background-color: #007BFF; color: #ffffff; text-decoration: none; border-radius: 5px;">Ir a Iniciar Sesión</a>
                </p>
                <p>Estamos listos para que disfrutes de nuestros productos.</p>
                <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                <p>¡Gracias por elegir Accesorios Apolo!</p>
                <p>Atentamente,<br>El equipo de Accesorios Apolo</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Correo de bienvenida enviado exitosamente a: ${destinatarioCorreo}`);
        return true;
    } catch (error) {
        console.error(`Error al enviar el correo de bienvenida a ${destinatarioCorreo}:`, error);
        return false;
    }
}

module.exports = {
    enviarCorreoBienvenida
};