const transporter = require('../config/mailer'); // Usar tu transportador existente

// Función para manejar el formulario de contacto
const handleContactForm = async (req, res) => {
  try {
    // Validar que todos los campos requeridos estén presentes
    const { nombre, correo, telefono, mensaje, metodo_contacto } = req.body;

    if (!nombre || !correo || !telefono || !mensaje || !metodo_contacto) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios'
      });
    }

    // Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
      return res.status(400).json({
        success: false,
        message: 'El formato del correo electrónico no es válido'
      });
    }

    // Validar método de contacto
    const metodosValidos = ['whatsapp', 'telefono', 'correo'];
    if (!metodosValidos.includes(metodo_contacto)) {
      return res.status(400).json({
        success: false,
        message: 'Método de contacto no válido'
      });
    }

    // Los datos se enviarán solo por correo, sin guardar en base de datos

    // Preparar el contenido del correo
    const metodoContactoTexto = {
      'whatsapp': 'WhatsApp',
      'telefono': 'Teléfono',
      'correo': 'Correo electrónico'
    };

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #333; text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
          📧 Nuevo Mensaje de Contacto
        </h2>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #007bff; margin-top: 0;">Información del Cliente:</h3>
          
          <div style="margin: 15px 0;">
            <strong style="color: #495057;">👤 Nombre:</strong>
            <span style="margin-left: 10px;">${nombre}</span>
          </div>
          
          <div style="margin: 15px 0;">
            <strong style="color: #495057;">📧 Correo:</strong>
            <span style="margin-left: 10px;">${correo}</span>
          </div>
          
          <div style="margin: 15px 0;">
            <strong style="color: #495057;">📱 Teléfono:</strong>
            <span style="margin-left: 10px;">${telefono}</span>
          </div>
          
          <div style="margin: 15px 0;">
            <strong style="color: #495057;">📞 Método de contacto preferido:</strong>
            <span style="margin-left: 10px; color: #007bff; font-weight: bold;">${metodoContactoTexto[metodo_contacto]}</span>
          </div>
        </div>
        
        <div style="background-color: #fff; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
          <h3 style="color: #007bff; margin-top: 0;">💬 Mensaje:</h3>
          <p style="line-height: 1.6; color: #495057; white-space: pre-wrap;">${mensaje}</p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 8px;">
          <small style="color: #6c757d;">
            📅 Recibido el: ${new Date().toLocaleString('es-ES', { 
              timeZone: 'America/Bogota',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </small>
        </div>
      </div>
    `;

    // Configurar y enviar el correo usando tu transportador existente
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'tiendaaccesoriosapolo@gmail.com',
      subject: `💌 Nuevo contacto de ${nombre} - ${metodoContactoTexto[metodo_contacto]}`,
      html: htmlContent,
      // También incluir versión de texto plano
      text: `
Nuevo mensaje de contacto:

Nombre: ${nombre}
Correo: ${correo}
Teléfono: ${telefono}
Método de contacto preferido: ${metodoContactoTexto[metodo_contacto]}

Mensaje:
${mensaje}

Recibido el: ${new Date().toLocaleString('es-ES', { timeZone: 'America/Bogota' })}
      `
    };

    // Enviar el correo
    await transporter.sendMail(mailOptions);

    // Respuesta exitosa
    res.status(200).json({
      success: true,
      message: 'Mensaje enviado correctamente. Te contactaremos pronto.',
      data: {
        nombre,
        correo,
        metodo_contacto: metodoContactoTexto[metodo_contacto],
        fecha: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error al procesar formulario de contacto:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor. Por favor intenta nuevamente.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Middleware para validar el método HTTP
const validateContactMethod = (req, res, next) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método no permitido. Use POST.'
    });
  }
  next();
};

// Ruta para el formulario de contacto
const setupContactRoute = (app) => {
  app.post('/api/contacto', validateContactMethod, handleContactForm);
  
  // Ruta adicional para verificar que el endpoint esté funcionando
  app.get('/api/contacto/status', (req, res) => {
    res.json({
      success: true,
      message: 'Endpoint de contacto funcionando correctamente',
      timestamp: new Date().toISOString()
    });
  });
};

module.exports = {
  handleContactForm,
  setupContactRoute,
  validateContactMethod
};