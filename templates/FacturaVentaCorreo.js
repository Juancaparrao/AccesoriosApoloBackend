const transporter = require('../config/mailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generarPDFFactura(datosFactura) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const nombreArchivo = `factura_${datosFactura.id_factura}_${Date.now()}.pdf`;
      const rutaArchivo = path.join(__dirname, '../temp/', nombreArchivo);

      if (!fs.existsSync(path.dirname(rutaArchivo))) {
        fs.mkdirSync(path.dirname(rutaArchivo), { recursive: true });
      }

      const stream = fs.createWriteStream(rutaArchivo);
      doc.pipe(stream);

      doc.fontSize(20).fillColor('#2c3e50').text('ACCESORIOS APOLO', 50, 50);
      doc.fontSize(12).fillColor('#7f8c8d')
        .text('NIT: 123.456.789-0', 50, 75)
        .text('Dirección: Calle 123 #45-67', 50, 90)
        .text('Teléfono: (601) 234-5678', 50, 105)
        .text('Email: info@accesoriosapolo.com', 50, 120);
      doc.moveTo(50, 140).lineTo(550, 140).stroke('#bdc3c7');

      doc.fontSize(16).fillColor('#2c3e50').text('FACTURA DE VENTA', 50, 160);
      doc.fontSize(12).fillColor('#34495e')
        .text(`Factura No: ${datosFactura.id_factura || 'N/A'}`, 50, 190)
        .text(`Fecha: ${datosFactura.fecha_venta || 'N/A'}`, 50, 205)
        .text(`Método de Pago: ${datosFactura.metodo_pago || 'N/A'}`, 50, 220);

      doc.fontSize(14).fillColor('#2c3e50').text('DATOS DEL CLIENTE', 50, 250);
      doc.fontSize(11).fillColor('#34495e')
        .text(`Cédula: ${datosFactura.cliente?.cedula || 'N/A'}`, 50, 275)
        .text(`Nombre: ${datosFactura.cliente?.nombre || 'N/A'}`, 50, 290)
        .text(`Teléfono: ${datosFactura.cliente?.telefono || 'N/A'}`, 50, 305)
        .text(`Correo: ${datosFactura.cliente?.correo || 'N/A'}`, 50, 320);

      doc.fontSize(14).fillColor('#2c3e50').text('PRODUCTOS VENDIDOS', 50, 350);
      const inicioTabla = 380;
      doc.fontSize(10).fillColor('#2c3e50')
        .text('REF.', 50, inicioTabla)
        .text('PRODUCTO', 100, inicioTabla)
        .text('CANT.', 300, inicioTabla)
        .text('PRECIO UNIT.', 350, inicioTabla)
        .text('SUBTOTAL', 450, inicioTabla);
      doc.moveTo(50, inicioTabla + 15).lineTo(550, inicioTabla + 15).stroke('#bdc3c7');

      let posicionY = inicioTabla + 25;
      
      // Validar que productos existe y es un array
      if (!datosFactura.productos || !Array.isArray(datosFactura.productos)) {
        console.error('❌ Error: datosFactura.productos no es válido:', datosFactura.productos);
        throw new Error('Los datos de productos no son válidos');
      }

      datosFactura.productos.forEach((producto, index) => {
        try {
          // Función helper para extraer números de strings de forma segura
          const extraerNumero = (valor, valorPorDefecto = '0') => {
            if (!valor) return parseFloat(valorPorDefecto);
            const numeroString = typeof valor === 'string' ? valor : String(valor);
            const numeroExtraido = numeroString.replace(/[^0-9.-]+/g, '');
            return parseFloat(numeroExtraido) || parseFloat(valorPorDefecto);
          };

          // Función helper para formatear valores de forma segura
          const formatearValor = (valor, esMoneda = false) => {
            if (!valor) return esMoneda ? '$0' : '0';
            if (typeof valor === 'string') return valor;
            return esMoneda ? `$${valor.toLocaleString()}` : String(valor);
          };

          // Extraer valores numéricos de forma segura
          const precioUnitarioNumerico = extraerNumero(producto.precio_unitario);
          const subtotalNumerico = extraerNumero(producto.subtotal);
          
          // Manejar precio_descuento que puede ser undefined, null o vacío
          let precioOriginalNumerico = precioUnitarioNumerico;
          let tieneDescuento = false;
          
          if (producto.precio_descuento && producto.precio_descuento !== '' && producto.precio_descuento !== '0') {
            precioOriginalNumerico = extraerNumero(producto.precio_descuento);
            tieneDescuento = precioOriginalNumerico > precioUnitarioNumerico;
          }

          // Mostrar valores en el PDF
          doc.fontSize(9).fillColor('#34495e')
            .text(producto.referencia || 'N/A', 50, posicionY)
            .text((producto.nombre || 'Producto sin nombre').substring(0, 25) + 
                  ((producto.nombre || '').length > 25 ? '...' : ''), 100, posicionY)
            .text(String(producto.cantidad || '0'), 300, posicionY)
            .text(formatearValor(producto.precio_unitario, true), 350, posicionY)
            .text(formatearValor(producto.subtotal, true), 450, posicionY);
          
          if (tieneDescuento) {
            doc.fontSize(8).fillColor('#e74c3c')
              .text(`(Precio original: ${formatearValor(producto.precio_descuento, true)})`, 350, posicionY + 12);
          }
          
          posicionY += tieneDescuento ? 30 : 20;
          if (posicionY > 700) {
            doc.addPage();
            posicionY = 50;
          }
        } catch (productoError) {
          console.error(`❌ Error procesando producto ${index}:`, productoError);
          console.error('Datos del producto:', producto);
          // Continuar con el siguiente producto en lugar de fallar completamente
          doc.fontSize(9).fillColor('#e74c3c')
            .text('Error en producto', 50, posicionY)
            .text('Datos no válidos', 100, posicionY);
          posicionY += 20;
        }
      });

      doc.moveTo(50, posicionY + 10).lineTo(550, posicionY + 10).stroke('#bdc3c7');
      doc.fontSize(14).fillColor('#2c3e50').text('VALOR TOTAL:', 350, posicionY + 25);
      doc.fontSize(16).fillColor('#014aad').text(datosFactura.valor_total || '$0', 450, posicionY + 25);
      doc.fontSize(10).fillColor('#7f8c8d')
        .text(`Total de productos: ${datosFactura.productos?.length || 0}`, 50, posicionY + 60)
        .text('Gracias por su compra en Accesorios Apolo', 50, posicionY + 80)
        .text('Para soporte técnico: soporte@accesoriosapolo.com', 50, posicionY + 95);

      // Corregir zona horaria para Colombia (UTC-5)
      const fechaActual = new Date();
      const fechaColombia = new Date(fechaActual.getTime() - (5 * 60 * 60 * 1000));
      const fechaFormateada = fechaColombia.toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      doc.fontSize(8).fillColor('#95a5a6')
        .text('Este documento es una factura de venta generada electrónicamente.', 50, posicionY + 120)
        .text(`Generado el: ${fechaFormateada}`, 50, posicionY + 135);
      doc.end();

      stream.on('finish', () => resolve(rutaArchivo));
      stream.on('error', reject);
    } catch (error) {
      console.error('❌ Error en generarPDFFactura:', error);
      reject(error);
    }
  });
}

async function enviarFacturaPorCorreo(emailDestino, datosFactura) {
  try {
    // Agregar logs para debug
    console.log('📧 Iniciando envío de factura por correo...');
    console.log('📋 Datos de factura recibidos:', {
      id_factura: datosFactura?.id_factura,
      cliente: datosFactura?.cliente?.nombre,
      productos_count: datosFactura?.productos?.length,
      valor_total: datosFactura?.valor_total
    });

    // Validaciones básicas
    if (!emailDestino) {
      throw new Error('Email de destino no proporcionado');
    }

    if (!datosFactura) {
      throw new Error('Datos de factura no proporcionados');
    }

    if (!datosFactura.cliente) {
      throw new Error('Datos del cliente no proporcionados');
    }

    const rutaPDF = await generarPDFFactura(datosFactura);

    const opcionesCorreo = {
      from: { name: 'Accesorios Apolo', address: process.env.EMAIL_USER },
      to: emailDestino,
      subject: `Factura de Compra #${datosFactura.id_factura || 'N/A'} - Accesorios Apolo`,
      html: `<p>Estimado/a ${datosFactura.cliente?.nombre || 'Cliente'}, gracias por su compra. Adjuntamos su factura.</p>`,
      attachments: [
        {
          filename: `Factura_${datosFactura.id_factura || 'N-A'}.pdf`,
          path: rutaPDF,
          contentType: 'application/pdf'
        }
      ]
    };

    const resultado = await transporter.sendMail(opcionesCorreo);
    console.log('✅ Correo enviado:', resultado.messageId);

    // Limpiar archivo temporal después de 3 segundos
    setTimeout(() => {
      if (fs.existsSync(rutaPDF)) {
        fs.unlinkSync(rutaPDF);
        console.log('🗑️ Archivo temporal eliminado:', rutaPDF);
      }
    }, 3000);

    return { success: true, message: 'Correo enviado exitosamente' };
  } catch (error) {
    console.error('❌ Error al enviar correo:', error);
    console.error('📋 Datos que causaron el error:', {
      emailDestino,
      datosFactura: JSON.stringify(datosFactura, null, 2)
    });
    throw new Error(`Error al enviar correo: ${error.message}`);
  }
}

module.exports = {
  enviarFacturaPorCorreo
};