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

      // Helper para extraer y parsear números de forma segura
      // Esta función debe encargarse de convertir cualquier formato de entrada a un número flotante
      const extraerNumero = (valor, valorPorDefecto = 0) => {
        if (valor === undefined || valor === null || valor === '') return parseFloat(valorPorDefecto);
        let numeroString = String(valor);
        // Intentar limpiar el formato de moneda si viene, para obtener un número válido.
        // Reemplazar punto de miles y coma decimal por el formato estándar de JS (punto decimal)
        numeroString = numeroString.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.-]+/g, '');
        return parseFloat(numeroString) || parseFloat(valorPorDefecto);
      };

      // Helper para formatear valores de moneda a formato colombiano ($XX.XXX,XX)
      const formatearValor = (valor, esMoneda = false) => {
        const num = extraerNumero(valor); // Usa extraerNumero para asegurarse de que es un número válido
        if (isNaN(num)) return esMoneda ? '$0,00' : '0'; // Devuelve formato correcto si no es un número

        if (esMoneda) {
          // Usar Intl.NumberFormat para formatear correctamente la moneda colombiana
          return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 2, // Asegura dos decimales
            maximumFractionDigits: 2 // Asegura dos decimales
          }).format(num);
        }
        return String(num); // Para números que no son moneda
      };

      if (datosFactura.productos && Array.isArray(datosFactura.productos)) {
        datosFactura.productos.forEach((producto, index) => {
          try {
            const cantidad = extraerNumero(producto.cantidad);
            const precioUnitario = extraerNumero(producto.precio_unitario);
            // Calcular subtotal si es 0 o no válido, usando los números ya parseados
            const subtotalCalculado = cantidad * precioUnitario;
            const subtotalMostrar = (extraerNumero(producto.subtotal) === 0 || isNaN(extraerNumero(producto.subtotal))) ? subtotalCalculado : extraerNumero(producto.subtotal);

            let tieneDescuento = false;
            // Solo verificar descuento si precio_descuento es un número válido y mayor que precio_unitario
            if (producto.precio_descuento && extraerNumero(producto.precio_descuento) > precioUnitario) {
                tieneDescuento = true;
            }

            doc.fontSize(9).fillColor('#34495e')
              .text(producto.referencia || 'N/A', 50, posicionY)
              .text((producto.nombre || 'Producto sin nombre').substring(0, 25) +
                ((producto.nombre || '').length > 25 ? '...' : ''), 100, posicionY)
              .text(String(cantidad), 300, posicionY)
              .text(formatearValor(precioUnitario, true), 350, posicionY)
              .text(formatearValor(subtotalMostrar, true), 450, posicionY);

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
            doc.fontSize(9).fillColor('#e74c3c')
              .text('Error en producto', 50, posicionY)
              .text('Datos no válidos', 100, posicionY);
            posicionY += 20;
          }
        });
      }


      // --- Sección para Calcomanías en el PDF ---
      if (datosFactura.calcomanias && Array.isArray(datosFactura.calcomanias) && datosFactura.calcomanias.length > 0) {
        if (posicionY > 600) {
          doc.addPage();
          posicionY = 50;
        } else {
          posicionY += 30; // Espacio después de la tabla de productos
        }

        doc.fontSize(14).fillColor('#2c3e50').text('CALCOMANÍAS VENDIDAS', 50, posicionY);
        posicionY += 30;
        const inicioTablaCalcomanias = posicionY;
        doc.fontSize(10).fillColor('#2c3e50')
          .text('ID', 50, inicioTablaCalcomanias)
          .text('CALCOMANÍA', 100, inicioTablaCalcomanias)
          .text('TAMAÑO', 250, inicioTablaCalcomanias)
          .text('CANT.', 350, inicioTablaCalcomanias)
          .text('PRECIO UNIT.', 400, inicioTablaCalcomanias)
          .text('SUBTOTAL', 500, inicioTablaCalcomanias);
        doc.moveTo(50, inicioTablaCalcomanias + 15).lineTo(550, inicioTablaCalcomanias + 15).stroke('#bdc3c7');

        posicionY = inicioTablaCalcomanias + 25;

        datosFactura.calcomanias.forEach((calcomania, index) => {
          try {
            const cantidad = extraerNumero(calcomania.cantidad);
            const precioUnitario = extraerNumero(calcomania.precio_unitario);
            // Calcular subtotal si es 0 o no válido
            const subtotalCalculado = cantidad * precioUnitario;
            const subtotalMostrar = (extraerNumero(calcomania.subtotal) === 0 || isNaN(extraerNumero(calcomania.subtotal))) ? subtotalCalculado : extraerNumero(calcomania.subtotal);

            let tieneDescuento = false;
            if (calcomania.precio_descuento && extraerNumero(calcomania.precio_descuento) > precioUnitario) {
              tieneDescuento = true;
            }

            doc.fontSize(9).fillColor('#34495e')
              .text(String(calcomania.id || 'N/A'), 50, posicionY)
              .text((calcomania.nombre || 'Calcomanía sin nombre').substring(0, 20) +
                ((calcomania.nombre || '').length > 20 ? '...' : ''), 100, posicionY)
              .text(calcomania.tamano || 'N/A', 250, posicionY)
              .text(String(cantidad), 350, posicionY)
              .text(formatearValor(precioUnitario, true), 400, posicionY)
              .text(formatearValor(subtotalMostrar, true), 500, posicionY);

            if (tieneDescuento) {
              doc.fontSize(8).fillColor('#e74c3c')
                .text(`(Precio original: ${formatearValor(calcomania.precio_descuento, true)})`, 400, posicionY + 12);
            }

            posicionY += tieneDescuento ? 30 : 20;
            if (posicionY > 700) {
              doc.addPage();
              posicionY = 50;
            }
          } catch (calcomaniaError) {
            console.error(`❌ Error procesando calcomanía ${index}:`, calcomaniaError);
            console.error('Datos de la calcomanía:', calcomania);
            doc.fontSize(9).fillColor('#e74c3c')
              .text('Error en calcomanía', 50, posicionY)
              .text('Datos no válidos', 100, posicionY);
            posicionY += 20;
          }
        });
      }

      doc.moveTo(50, posicionY + 10).lineTo(550, posicionY + 10).stroke('#bdc3c7');
      doc.fontSize(14).fillColor('#2c3e50').text('VALOR TOTAL:', 350, posicionY + 25);
      doc.fontSize(16).fillColor('#014aad').text(formatearValor(datosFactura.valor_total, true) || '$0,00', 450, posicionY + 25);
      doc.fontSize(10).fillColor('#7f8c8d')
        .text(`Total de productos: ${datosFactura.productos?.length || 0}`, 50, posicionY + 60)
        .text('Gracias por su compra en Accesorios Apolo', 50, posicionY + 80)
        .text('Para soporte técnico: soporte@accesoriosapolo.com', 50, posicionY + 95);

      const fechaActual = new Date();
      // Asegurarse de que la fecha de Colombia se obtiene correctamente sin desfasajes UTC
      const fechaColombia = new Date(fechaActual.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
      const fechaFormateada = fechaColombia.toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // Formato de 24 horas
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
    console.log('📧 Iniciando envío de factura por correo...');
    console.log('📋 Datos de factura recibidos:', {
      id_factura: datosFactura?.id_factura,
      cliente: datosFactura?.cliente?.nombre,
      productos_count: datosFactura?.productos?.length,
      calcomanias_count: datosFactura?.calcomanias?.length,
      valor_total: datosFactura?.valor_total
    });

    if (!emailDestino) {
      throw new Error('Email de destino no proporcionado');
    }

    if (!datosFactura) {
      throw new Error('Datos de factura no proporcionados');
    }

    if (!datosFactura.cliente) {
      throw new Error('Datos del cliente no proporcionados');
    }

    // Helper para extraer y parsear números de forma segura
    const extraerNumero = (valor, valorPorDefecto = 0) => {
        if (valor === undefined || valor === null || valor === '') return parseFloat(valorPorDefecto);
        let numeroString = String(valor);
        numeroString = numeroString.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.-]+/g, '');
        return parseFloat(numeroString) || parseFloat(valorPorDefecto);
    };

    // Función auxiliar para formatear valores de moneda a formato colombiano ($XX.XXX,XX)
    const formatearMoneda = (valor) => {
        const num = extraerNumero(valor);
        if (isNaN(num)) return '$0,00';
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    const rutaPDF = await generarPDFFactura(datosFactura);

    // --- HTML para la tabla de productos ---
    let productosHtml = '';
    if (datosFactura.productos && Array.isArray(datosFactura.productos) && datosFactura.productos.length > 0) {
      productosHtml = `
            <h3>Productos Vendidos</h3>
            <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">REF.</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">PRODUCTO</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">CANT.</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">PRECIO UNIT.</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">SUBTOTAL</th>
                    </tr>
                </thead>
                <tbody>
        `;
      datosFactura.productos.forEach(producto => {
        const cantidad = extraerNumero(producto.cantidad);
        const precioUnitario = extraerNumero(producto.precio_unitario);
        const subtotalCalculado = cantidad * precioUnitario;
        const subtotalMostrar = (extraerNumero(producto.subtotal) === 0 || isNaN(extraerNumero(producto.subtotal))) ? subtotalCalculado : extraerNumero(producto.subtotal);

        let precioOriginalDisplay = '';
        if (producto.precio_descuento && extraerNumero(producto.precio_descuento) > precioUnitario) {
          precioOriginalDisplay = `<br><small style="color: #e74c3c;">(Original: ${formatearMoneda(producto.precio_descuento)})</small>`;
        }

        productosHtml += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${producto.referencia || 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${producto.nombre || 'Producto sin nombre'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${String(cantidad)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${formatearMoneda(precioUnitario)}${precioOriginalDisplay}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${formatearMoneda(subtotalMostrar)}</td>
                </tr>
            `;
      });
      productosHtml += `
                </tbody>
            </table>
        `;
    }

    // --- HTML para la tabla de calcomanías ---
    let calcomaniasHtml = '';
    if (datosFactura.calcomanias && Array.isArray(datosFactura.calcomanias) && datosFactura.calcomanias.length > 0) {
      calcomaniasHtml = `
            <h3>Calcomanías Vendidas</h3>
            <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">ID</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">CALCOMANÍA</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">TAMAÑO</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">CANT.</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">PRECIO UNIT.</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">SUBTOTAL</th>
                    </tr>
                </thead>
                <tbody>
        `;
      datosFactura.calcomanias.forEach(calcomania => {
        const cantidad = extraerNumero(calcomania.cantidad);
        const precioUnitario = extraerNumero(calcomania.precio_unitario);
        const subtotalCalculado = cantidad * precioUnitario;
        const subtotalMostrar = (extraerNumero(calcomania.subtotal) === 0 || isNaN(extraerNumero(calcomania.subtotal))) ? subtotalCalculado : extraerNumero(calcomania.subtotal);

        let precioOriginalDisplay = '';
        if (calcomania.precio_descuento && extraerNumero(calcomania.precio_descuento) > precioUnitario) {
          precioOriginalDisplay = `<br><small style="color: #e74c3c;">(Original: ${formatearMoneda(calcomania.precio_descuento)})</small>`;
        }

        calcomaniasHtml += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${calcomania.id || 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${calcomania.nombre || 'Calcomanía sin nombre'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${calcomania.tamano || 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${String(cantidad)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${formatearMoneda(precioUnitario)}${precioOriginalDisplay}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${formatearMoneda(subtotalMostrar)}</td>
                </tr>
            `;
      });
      calcomaniasHtml += `
                </tbody>
            </table>
        `;
    }

    const valorTotalFormatted = formatearMoneda(datosFactura.valor_total);

    const opcionesCorreo = {
      from: { name: 'Accesorios Apolo', address: process.env.EMAIL_USER },
      to: emailDestino,
      subject: `Factura de Compra #${datosFactura.id_factura || 'N/A'} - Accesorios Apolo`,
      html: `
            <p>Estimado/a ${datosFactura.cliente?.nombre || 'Cliente'},</p>
            <p>Gracias por su reciente compra en Accesorios Apolo. Adjuntamos su factura en formato PDF.</p>
            <p>Aquí tiene un resumen de su compra:</p>
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #2c3e50;">Detalles de la Factura</h2>
                <p><strong>Factura No:</strong> ${datosFactura.id_factura || 'N/A'}</p>
                <p><strong>Fecha:</strong> ${datosFactura.fecha_venta || 'N/A'}</p>
                <p><strong>Método de Pago:</strong> ${datosFactura.metodo_pago || 'N/A'}</p>

                <h3 style="color: #2c3e50;">Datos del Cliente</h3>
                <p><strong>Cédula:</strong> ${datosFactura.cliente?.cedula || 'N/A'}</p>
                <p><strong>Nombre:</strong> ${datosFactura.cliente?.nombre || 'N/A'}</p>
                <p><strong>Teléfono:</strong> ${datosFactura.cliente?.telefono || 'N/A'}</p>
                <p><strong>Correo:</strong> ${datosFactura.cliente?.correo || 'N/A'}</p>

                ${productosHtml}
                ${calcomaniasHtml}

                <p style="font-size: 1.2em; font-weight: bold; text-align: right; margin-top: 20px;">
                    VALOR TOTAL: <span style="color: #014aad;">${valorTotalFormatted}</span>
                </p>

                <p style="text-align: center; margin-top: 30px; font-size: 0.9em; color: #7f8c8d;">
                    Gracias por su compra en Accesorios Apolo.<br>
                    Para soporte técnico: <a href="mailto:soporte@accesoriosapolo.com" style="color: #014aad;">soporte@accesoriosapolo.com</a>
                </p>
            </div>
            `,
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