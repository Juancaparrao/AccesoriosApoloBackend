// services/emailService.js

const transporter = require('../config/mailer'); // Asegúrate que la ruta a tu config de nodemailer es correcta
const PDFDocument = require('pdfkit');
const fs = require('fs'); // Corregido: 'fs' es un módulo, no un string
const path = require('path');

/**
 * Genera una factura en formato PDF a partir de los datos proporcionados.
 * @param {object} datosFactura - Objeto con toda la información de la factura.
 * @returns {Promise<string>} - Promesa que se resuelve con la ruta al archivo PDF generado.
 */
function generarPDFFactura(datosFactura) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const nombreArchivo = `factura_${datosFactura.id_factura}_${Date.now()}.pdf`;
      const tempDir = path.join(__dirname, '../temp/');

      // Asegurarse de que el directorio temporal exista
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const rutaArchivo = path.join(tempDir, nombreArchivo);

      const stream = fs.createWriteStream(rutaArchivo);
      doc.pipe(stream);

      // --- Cabecera ---
      doc.fontSize(20).fillColor('#2c3e50').text('ACCESORIOS APOLO', { align: 'center' });
      doc.moveDown(0.5);

      // --- Info Factura y Cliente ---
      doc.fontSize(12).fillColor('#34495e')
        .text(`Factura No: ${datosFactura.id_factura || 'N/A'}`, 50, 150)
        .text(`Fecha: ${datosFactura.fecha_venta || 'N/A'}`, 50, 165)
        .text(`Método de Pago: ${datosFactura.metodo_pago || 'N/A'}`, 50, 180);

      doc.fontSize(12).fillColor('#34495e')
        .text(`Cliente: ${datosFactura.cliente?.nombre || 'N/A'}`, 300, 150)
        .text(`Cédula: ${datosFactura.cliente?.cedula || 'N/A'}`, 300, 165)
        .text(`Correo: ${datosFactura.cliente?.correo || 'N/A'}`, 300, 180);
      
      doc.moveDown(3);

      // --- Tabla de Items ---
      const tableTop = 220;
      doc.font('Helvetica-Bold');
      doc.fontSize(10).text('Ref/ID', 50, tableTop)
         .text('Descripción', 110, tableTop)
         .text('Cant.', 340, tableTop, { width: 40, align: 'right' })
         .text('Precio Unit.', 390, tableTop, { width: 70, align: 'right' })
         .text('Subtotal', 470, tableTop, { width: 80, align: 'right' });
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke('#ccc');
      doc.font('Helvetica');

      let currentY = tableTop + 25;

      const formatCurrency = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);

      const items = [
          ...(datosFactura.productos || []).map(p => ({...p, tipo: 'Producto'})),
          ...(datosFactura.calcomanias || []).map(c => ({...c, tipo: 'Calcomanía'}))
      ];

      items.forEach(item => {
        const id = item.referencia || item.id || 'N/A';
        const name = item.nombre || 'N/A';
        const desc = item.tipo === 'Calcomanía' ? `Calcomanía (${item.tamano})` : name;
        const cant = item.cantidad || 0;
        const price = parseFloat(item.precio_unidad) || 0;
        const subtotal = cant * price;
        
        doc.fontSize(9).text(id, 50, currentY, { width: 50 });
        doc.text(desc, 110, currentY, { width: 220 });
        doc.text(cant, 340, currentY, { width: 40, align: 'right' });
        doc.text(formatCurrency(price), 390, currentY, { width: 70, align: 'right' });
        doc.text(formatCurrency(subtotal), 470, currentY, { width: 80, align: 'right' });
        
        currentY += 20;
        if (currentY > 700) { doc.addPage(); currentY = 50; }
      });

      // --- Totales ---
      doc.moveTo(380, currentY + 10).lineTo(550, currentY + 10).stroke('#333');
      doc.font('Helvetica-Bold').fontSize(12).text('TOTAL:', 380, currentY + 20, { align: 'left' });
      doc.text(formatCurrency(datosFactura.valor_total || 0), 470, currentY + 20, { align: 'right' });
      
      // --- Pie de página ---
      doc.fontSize(8).fillColor('#7f8c8d').text('Gracias por su compra.', 50, 750, { align: 'center', width: 500 });

      doc.end();
      stream.on('finish', () => resolve(rutaArchivo));
      stream.on('error', reject);
    } catch (error) {
      console.error('❌ Error en generarPDFFactura:', error);
      reject(error);
    }
  });
}

/**
 * Envía un correo electrónico con la factura en PDF adjunta.
 * @param {string} emailDestino - Correo del cliente.
 * @param {object} datosFactura - Objeto con los datos de la factura.
 * @returns {Promise<object>} - Promesa que se resuelve con el resultado del envío.
 */
async function   enviarFacturaOnlinePorCorreo (emailDestino, datosFactura) {
  try {
    if (!emailDestino || !datosFactura || !datosFactura.cliente) {
      throw new Error('Faltan datos de destino o de factura para enviar el correo.');
    }

    const rutaPDF = await generarPDFFactura(datosFactura);

    const opcionesCorreo = {
      from: { name: 'Accesorios Apolo', address: process.env.EMAIL_USER },
      to: emailDestino,
      subject: `✅ Tu Compra en Accesorios Apolo ha sido confirmada - Factura #${datosFactura.id_factura}`,
      html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;">
                <h2 style="color: #2c3e50;">¡Gracias por tu compra, ${datosFactura.cliente.nombre}!</h2>
                <p>Tu pedido ha sido confirmado y se está procesando. Adjunto encontrarás la factura detallada de tu compra en formato PDF.</p>
                <p><strong>Número de Factura:</strong> ${datosFactura.id_factura}</p>
                <p><strong>Valor Total:</strong> ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(datosFactura.valor_total)}</p>
                <hr>
                <p style="font-size: 0.9em; color: #777;">
                    Si tienes alguna pregunta sobre tu pedido, no dudes en contactarnos.
                </p>
                <p style="text-align: center; margin-top: 20px;"><strong>Accesorios Apolo</strong></p>
            </div>
      `,
      attachments: [{
          filename: `Factura_${datosFactura.id_factura}.pdf`,
          path: rutaPDF,
          contentType: 'application/pdf'
      }]
    };

    const resultado = await transporter.sendMail(opcionesCorreo);
    console.log('✅ Correo de factura enviado:', resultado.messageId);

    // Limpiar el archivo temporal después de un breve momento
    setTimeout(() => {
      if (fs.existsSync(rutaPDF)) {
        fs.unlinkSync(rutaPDF);
        console.log('🗑️ Archivo PDF temporal eliminado:', rutaPDF);
      }
    }, 5000);

    return { success: true, message: 'Correo enviado exitosamente' };
  } catch (error) {
    console.error('❌ Error al enviar factura por correo:', error);
    // No relanzar el error para no afectar el flujo principal de la compra, solo registrarlo.
    return { success: false, message: `Error al enviar correo: ${error.message}` };
  }
}

module.exports = {
  enviarFacturaOnlinePorCorreo
};