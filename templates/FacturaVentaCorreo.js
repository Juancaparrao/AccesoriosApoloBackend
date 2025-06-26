const transporter = require('../config/mailer'); // Asegúrate de que esta ruta sea correcta
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Genera un archivo PDF para la factura de venta.
 * @param {object} datosFactura - Objeto con todos los datos de la factura (principal, cliente, productos, calcomanías).
 * @returns {Promise<string>} - Promesa que resuelve con la ruta del archivo PDF generado.
 */
function generarPDFFactura(datosFactura) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            // Genera un nombre de archivo único para evitar conflictos
            const nombreArchivo = `factura_${datosFactura.id_factura}_${Date.now()}.pdf`;
            // Define la ruta donde se guardará el archivo PDF temporalmente
            const rutaArchivo = path.join(__dirname, '../temp/', nombreArchivo);

            // Crea el directorio 'temp' si no existe
            if (!fs.existsSync(path.dirname(rutaArchivo))) {
                fs.mkdirSync(path.dirname(rutaArchivo), { recursive: true });
            }

            // Crea un flujo de escritura para guardar el PDF
            const stream = fs.createWriteStream(rutaArchivo);
            doc.pipe(stream);

            // --- Encabezado de la Factura: Información de la Empresa ---
            doc.fontSize(20).fillColor('#2c3e50').text('ACCESORIOS APOLO', 50, 50);
            doc.fontSize(12).fillColor('#7f8c8d')
                .text('NIT: 123.456.789-0', 50, 75)
                .text('Dirección: Calle 123 #45-67', 50, 90)
                .text('Teléfono: (601) 234-5678', 50, 105)
                .text('Email: info@accesoriosapolo.com', 50, 120);
            // Línea separadora
            doc.moveTo(50, 140).lineTo(550, 140).stroke('#bdc3c7');

            // --- Detalles de la Factura ---
            doc.fontSize(16).fillColor('#2c3e50').text('FACTURA DE VENTA', 50, 160);
            doc.fontSize(12).fillColor('#34495e')
                .text(`Factura No: ${datosFactura.id_factura || 'N/A'}`, 50, 190)
                // Formatea la fecha a un formato legible para Colombia
                .text(`Fecha: ${new Date(datosFactura.fecha_venta).toLocaleDateString('es-CO') || 'N/A'}`, 50, 205)
                .text(`Método de Pago: ${datosFactura.metodo_pago || 'N/A'}`, 50, 220);

            // --- Datos del Cliente ---
            doc.fontSize(14).fillColor('#2c3e50').text('DATOS DEL CLIENTE', 50, 250);
            doc.fontSize(11).fillColor('#34495e')
                .text(`Cédula: ${datosFactura.cliente?.cedula || 'N/A'}`, 50, 275)
                .text(`Nombre: ${datosFactura.cliente?.nombre || 'N/A'}`, 50, 290)
                .text(`Teléfono: ${datosFactura.cliente?.telefono || 'N/A'}`, 50, 305)
                .text(`Correo: ${datosFactura.cliente?.correo || 'N/A'}`, 50, 320);

            // --- Encabezado de la Tabla de Productos/Calcomanías ---
            doc.fontSize(14).fillColor('#2c3e50').text('PRODUCTOS / CALCOMANÍAS', 50, 350);
            const inicioTabla = 380;
            doc.fontSize(10).fillColor('#2c3e50')
                .text('REF./ID', 50, inicioTabla)
                .text('PRODUCTO / CALCOMANÍA', 100, inicioTabla)
                .text('CANT.', 300, inicioTabla)
                .text('PRECIO UNIT.', 350, inicioTabla)
                .text('SUBTOTAL', 450, inicioTabla);
            // Línea separadora de la cabecera de la tabla
            doc.moveTo(50, inicioTabla + 15).lineTo(550, inicioTabla + 15).stroke('#bdc3c7');

            let posicionY = inicioTabla + 25;

            // Validación de los datos de los ítems
            if (!datosFactura.items || !Array.isArray(datosFactura.items)) {
                console.error('❌ Error: datosFactura.items no es válido:', datosFactura.items);
                throw new Error('Los datos de productos/calcomanías no son válidos');
            }

            /**
             * Función auxiliar para formatear valores numéricos a cadenas,
             * opcionalmente como moneda.
             * @param {number|string|null|undefined} valor - El valor a formatear.
             * @param {boolean} esMoneda - Indica si el valor debe ser formateado como moneda.
             * @returns {string} - El valor formateado.
             */
            const formatearValor = (valor, esMoneda = false) => {
                // Maneja valores nulos, indefinidos o no numéricos
                if (valor === null || typeof valor === 'undefined' || isNaN(valor)) {
                    return esMoneda ? '$0.00' : 'N/A';
                }
                // Formatea como moneda si es requerido, con 2 decimales y formato colombiano
                if (esMoneda) {
                    return `$${parseFloat(valor).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                }
                // Retorna el valor como cadena si no es moneda
                return String(valor);
            };

            // --- Bucle para Cargar los Ítems (Productos y Calcomanías) en la Tabla ---
            datosFactura.items.forEach((item, index) => {
                try {
                    // Determina la referencia o ID según el tipo de ítem
                    const refOrId = item.type === 'producto' ? item.referencia : `CALC-${item.id_calcomania}`;
                    // Construye el nombre del ítem, añadiendo el tamaño si es una calcomanía
                    const nombreItem = item.type === 'calcomania' && item.tamano ? `${item.nombre} (${item.tamano})` : item.nombre;
                    // Precio unitario final al que se vendió el ítem
                    const precioUnitario = item.precio_unidad_final_vendido;
                    // Subtotal de la línea del ítem
                    const subtotalItem = item.subtotal_item;

                    // Muestra la información del ítem en el PDF
                    doc.fontSize(9).fillColor('#34495e')
                        .text(refOrId || 'N/A', 50, posicionY)
                        // Limita la longitud del nombre para que quepa en la columna
                        .text((nombreItem || 'Artículo sin nombre').substring(0, 35) +
                            ((nombreItem || '').length > 35 ? '...' : ''), 100, posicionY)
                        .text(String(item.cantidad || '0'), 300, posicionY)
                        .text(formatearValor(precioUnitario, true), 350, posicionY)
                        .text(formatearValor(subtotalItem, true), 450, posicionY);

                    // Si existe un "precio original" que es mayor al precio unitario final (implica descuento)
                    if (item.precio_original_con_descuento_display !== null && item.precio_original_con_descuento_display > precioUnitario) {
                        doc.fontSize(8).fillColor('#e74c3c')
                            .text(`(Original: ${formatearValor(item.precio_original_con_descuento_display, true)})`, 350, posicionY + 12);
                    }

                    // Ajusta la posición Y para el siguiente ítem, considerando si se mostró un precio original
                    posicionY += (item.precio_original_con_descuento_display !== null && item.precio_original_con_descuento_display > precioUnitario) ? 30 : 20;
                    // Si se alcanza el final de la página, añade una nueva página
                    if (posicionY > 700) {
                        doc.addPage();
                        posicionY = 50; // Reinicia la posición Y en la nueva página
                    }
                } catch (itemError) {
                    console.error(`❌ Error procesando artículo ${index}:`, itemError);
                    console.error('Datos del artículo:', item);
                    // Muestra un mensaje de error en el PDF si un ítem falla
                    doc.fontSize(9).fillColor('#e74c3c')
                        .text('Error en artículo', 50, posicionY)
                        .text('Datos no válidos', 100, posicionY);
                    posicionY += 20;
                }
            });

            // --- Totales de la Factura ---
            doc.moveTo(50, posicionY + 10).lineTo(550, posicionY + 10).stroke('#bdc3c7'); // Línea separadora
            doc.fontSize(14).fillColor('#2c3e50').text('VALOR TOTAL:', 350, posicionY + 25);
            doc.fontSize(16).fillColor('#014aad').text(formatearValor(datosFactura.valor_total, true) || '$0.00', 450, posicionY + 25);
            doc.fontSize(10).fillColor('#7f8c8d')
                .text(`Total de artículos: ${datosFactura.items?.length || 0}`, 50, posicionY + 60)
                .text('Gracias por su compra en Accesorios Apolo', 50, posicionY + 80)
                .text('Para soporte técnico: soporte@accesoriosapolo.com', 50, posicionY + 95);

            // --- Información del Pie de Página (Fecha de Generación) ---
            // Ajusta la zona horaria a Colombia (UTC-5) para la fecha de generación
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
            doc.end(); // Finaliza la creación del documento PDF

            // Resuelve la promesa cuando el flujo de escritura termina
            stream.on('finish', () => resolve(rutaArchivo));
            // Rechaza la promesa si hay un error en el flujo de escritura
            stream.on('error', reject);
        } catch (error) {
            console.error('❌ Error en generarPDFFactura:', error);
            reject(error);
        }
    });
}

/**
 * Envía la factura por correo electrónico.
 * Esta función ahora consulta todos los datos de la factura de la base de datos.
 * @param {string} emailDestino - Dirección de correo electrónico del destinatario.
 * @param {number} idFactura - ID de la factura a enviar.
 * @param {object} pool - Conexión al pool de la base de datos (ej. MySQL pool).
 * @returns {Promise<object>} - Promesa que resuelve con el estado del envío.
 */
async function enviarFacturaPorCorreo(emailDestino, idFactura, pool) {
    try {
        // Logs para depuración
        console.log('📧 Iniciando envío de factura por correo...');
        console.log('📋 Datos de envío recibidos:', { emailDestino, idFactura });

        // Validaciones básicas
        if (!emailDestino) {
            throw new Error('Email de destino no proporcionado');
        }
        if (!idFactura) {
            throw new Error('ID de factura no proporcionado');
        }
        if (!pool) {
            throw new Error('Conexión a la base de datos (pool) no proporcionada');
        }

        // 1. Obtener los detalles principales de la FACTURA y del USUARIO (cliente)
        const [facturaRows] = await pool.execute(
            `SELECT
                f.id_factura,
                f.fecha_venta,
                f.metodo_pago,
                f.valor_total,
                u.cedula,
                u.nombre AS cliente_nombre,
                u.telefono AS cliente_telefono,
                u.correo AS cliente_correo
             FROM FACTURA f
             JOIN USUARIO u ON f.fk_id_usuario = u.id_usuario
             WHERE f.id_factura = ?`,
            [idFactura]
        );

        if (facturaRows.length === 0) {
            throw new Error(`Factura con ID ${idFactura} no encontrada.`);
        }
        const factura = facturaRows[0];

        // Objeto para almacenar todos los datos que se pasarán al PDF
        let datosFactura = {
            id_factura: factura.id_factura,
            fecha_venta: factura.fecha_venta,
            metodo_pago: factura.metodo_pago,
            valor_total: parseFloat(factura.valor_total),
            cliente: {
                cedula: factura.cedula,
                nombre: factura.cliente_nombre,
                telefono: factura.cliente_telefono,
                correo: factura.cliente_correo
            },
            items: [] // Array combinado para productos y calcomanías
        };

        // 2. Obtener los detalles de los productos de DETALLE_FACTURA
        const [productosDetalle] = await pool.execute(
            `SELECT
                df.FK_referencia_producto AS referencia,
                df.cantidad,
                df.precio_unidad, -- Este es el precio por unidad al momento de la venta
                p.nombre,
                p.precio_unidad AS producto_precio_base, -- Precio base del producto de la tabla PRODUCTO
                p.precio_descuento AS producto_precio_descuento -- Precio de descuento del producto de la tabla PRODUCTO
             FROM DETALLE_FACTURA df
             JOIN PRODUCTO p ON df.FK_referencia_producto = p.referencia
             WHERE df.FK_id_factura = ?`,
            [idFactura]
        );

        productosDetalle.forEach(item => {
            const precioUnitarioVendido = parseFloat(item.precio_unidad); // Precio al que se vendió
            const precioBaseProducto = parseFloat(item.producto_precio_base); // Precio original base del producto
            const precioDescuentoProducto = item.producto_precio_descuento ? parseFloat(item.producto_precio_descuento) : null;

            let precioOriginalDisplay = null; // Por defecto, no se muestra precio original

            // Lógica para determinar si se debe mostrar un precio "original" (antes de descuento)
            // Esto ocurre si el precio de venta es menor que el precio base original del producto,
            // o si el producto tiene un precio_descuento definido y el precio de venta coincide con él.
            const epsilon = 0.01; // Margen para comparación de números flotantes
            if (precioDescuentoProducto !== null && precioDescuentoProducto < precioBaseProducto) {
                // Si el precio vendido es el precio con descuento del producto o es menor que el precio base
                if (Math.abs(precioUnitarioVendido - precioDescuentoProducto) < epsilon || precioUnitarioVendido < precioBaseProducto - epsilon) {
                    precioOriginalDisplay = precioBaseProducto; // El precio base es el original
                }
            } else if (precioUnitarioVendido < precioBaseProducto - epsilon) {
                 // Si no hay descuento en la tabla producto, pero el vendido es menor al base
                 precioOriginalDisplay = precioBaseProducto;
            }


            datosFactura.items.push({
                type: 'producto',
                referencia: item.referencia,
                nombre: item.nombre,
                cantidad: item.cantidad,
                precio_unidad_final_vendido: precioUnitarioVendido,
                precio_original_con_descuento_display: precioOriginalDisplay,
                subtotal_item: parseFloat((precioUnitarioVendido * item.cantidad).toFixed(2))
            });
        });

        // 3. Obtener los detalles de las calcomanías de DETALLE_FACTURA_CALCOMANIA
        const [calcomaniasDetalle] = await pool.execute(
            `SELECT
                dfc.FK_id_calcomania AS id_calcomania,
                dfc.cantidad,
                dfc.precio_unidad, -- Este es el precio por unidad al momento de la venta
                dfc.tamano,
                c.nombre,
                c.precio_unidad AS calcomania_precio_base_small, -- Precio base para 'pequeno' de la tabla CALCOMANIA
                c.precio_descuento AS calcomania_precio_descuento_small -- Precio de descuento de CALCOMANIA (para 'pequeno')
             FROM DETALLE_FACTURA_CALCOMANIA dfc
             JOIN CALCOMANIA c ON dfc.FK_id_calcomania = c.id_calcomania
             WHERE dfc.FK_id_factura = ?`,
            [idFactura]
        );

        calcomaniasDetalle.forEach(item => {
            const precioUnitarioVendido = parseFloat(item.precio_unidad); // Precio al que se vendió
            const calcomaniaPrecioBaseSmall = parseFloat(item.calcomania_precio_base_small); // Precio base para tamaño pequeño
            const calcomaniaPrecioDescuentoSmall = item.calcomania_precio_descuento_small ? parseFloat(item.calcomania_precio_descuento_small) : null;
            const tamano = item.tamano;

            let originalPriceForThisSize = calcomaniaPrecioBaseSmall; // Precio base original ajustado por tamaño (sin descuentos)

            // Ajusta el precio base original según los multiplicadores de tamaño
            switch (tamano) {
                case 'mediano':
                    originalPriceForThisSize = calcomaniaPrecioBaseSmall + (calcomaniaPrecioBaseSmall * 1.25);
                    break;
                case 'grande':
                    originalPriceForT
                    hisSize = calcomaniaPrecioBaseSmall + (calcomaniaPrecioBaseSmall * 3.00);
                    break;
            }
            originalPriceForThisSize = parseFloat(originalPriceForThisSize.toFixed(2)); // Redondea para comparaciones precisas

            let precioOriginalDisplay = null; // Por defecto, no se muestra precio original

            const epsilon = 0.01; // Pequeño margen para comparación de números flotantes

            // Lógica para determinar si se muestra un precio "original" para calcomanías
            // Esto refleja la lógica de `BuscarCalcomaniaVentaPorId` para calcular descuentos.
            if (calcomaniaPrecioDescuentoSmall !== null && calcomaniaPrecioDescuentoSmall > 0 && calcomaniaPrecioDescuentoSmall < calcomaniaPrecioBaseSmall) {
                // Hay un descuento base definido para la calcomanía pequeña
                const percentage_discount_from_base = ((calcomaniaPrecioBaseSmall - calcomaniaPrecioDescuentoSmall) / calcomaniaPrecioBaseSmall);
                const theoreticalDiscountedPriceForThisSize = parseFloat((originalPriceForThisSize * (1 - percentage_discount_from_base)).toFixed(2));

                // Si el precio vendido es el precio teórico con descuento o menor que el original
                if (Math.abs(precioUnitarioVendido - theoreticalDiscountedPriceForThisSize) < epsilon || precioUnitarioVendido < originalPriceForThisSize - epsilon) {
                    precioOriginalDisplay = originalPriceForThisSize;
                }
            } else {
                // No hay descuento base definido para la calcomanía pequeña
                // Si el precio vendido es menor que el precio original para este tamaño (indica un descuento personalizado)
                if (precioUnitarioVendido < originalPriceForThisSize - epsilon) {
                    precioOriginalDisplay = originalPriceForThisSize;
                }
            }


            datosFactura.items.push({
                type: 'calcomania',
                id_calcomania: item.id_calcomania,
                nombre: item.nombre,
                cantidad: item.cantidad,
                tamano: item.tamano,
                precio_unidad_final_vendido: precioUnitarioVendido,
                precio_original_con_descuento_display: precioOriginalDisplay, // Será null si no hay un precio original claro para mostrar
                subtotal_item: parseFloat((precioUnitarioVendido * item.cantidad).toFixed(2))
            });
        });

        // Ordenar los ítems (productos y calcomanías) para una presentación consistente en el PDF
        datosFactura.items.sort((a, b) => {
            if (a.type === b.type) {
                return (a.nombre || '').localeCompare(b.nombre || ''); // Orden alfabético por nombre
            }
            return a.type === 'producto' ? -1 : 1; // Primero productos, luego calcomanías
        });


        console.log('📋 Datos de factura procesados para PDF:', JSON.stringify(datosFactura, null, 2));

        // Genera el archivo PDF
        const rutaPDF = await generarPDFFactura(datosFactura);

        // Opciones del correo electrónico para enviar la factura
        const opcionesCorreo = {
            from: { name: 'Accesorios Apolo', address: process.env.EMAIL_USER }, // Remitente del correo
            to: emailDestino, // Destinatario
            subject: `Factura de Compra #${datosFactura.id_factura || 'N/A'} - Accesorios Apolo`, // Asunto
            html: `<p>Estimado/a ${datosFactura.cliente?.nombre || 'Cliente'}, gracias por su compra. Adjuntamos su factura.</p>`, // Cuerpo HTML
            attachments: [ // Archivos adjuntos
                {
                    filename: `Factura_${datosFactura.id_factura || 'N-A'}.pdf`,
                    path: rutaPDF,
                    contentType: 'application/pdf'
                }
            ]
        };

        // Envía el correo
        const resultado = await transporter.sendMail(opcionesCorreo);
        console.log('✅ Correo enviado:', resultado.messageId);

        // Limpia el archivo PDF temporal después de 3 segundos
        setTimeout(() => {
            if (fs.existsSync(rutaPDF)) {
                fs.unlinkSync(rutaPDF);
                console.log('🗑️ Archivo temporal eliminado:', rutaPDF);
            }
        }, 3000);

        return { success: true, message: 'Correo enviado exitosamente' };
    } catch (error) {
        console.error('❌ Error al enviar correo:', error);
        // Logs de depuración adicionales en caso de error
        console.error('📋 Datos que causaron el error:', {
            emailDestino,
            idFactura,
            error_message: error.message
        });
        throw new Error(`Error al enviar correo: ${error.message}`);
    }
}

// Exporta la función para que pueda ser utilizada en otras partes de la aplicación
module.exports = {
    enviarFacturaPorCorreo
};
