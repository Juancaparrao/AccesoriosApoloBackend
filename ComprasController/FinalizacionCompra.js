// controllers/invoiceManager.js
const pool = require('../db');
const { enviarFacturaOnlinePorCorreo } = require('../templates/FacturaVentaOnlineCorreo');


// --- CONSTANTES DE CONFIGURACIÓN ---
// Define el tiempo de vida de una factura pendiente en minutos.
const TIEMPO_EXPIRACION_MINUTOS = 5; 
// Define cada cuánto se ejecutará la tarea de limpieza (en milisegundos).
// 1 minuto (60000 ms) es un buen valor. Es frecuente pero no sobrecarga el sistema.
const INTERVALO_VERIFICACION_MS = 60000; 


async function completarFacturaPagada(facturaId, userId) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        console.log(`--- Completando factura pagada ${facturaId} para usuario ${userId} ---`);

        // 1. Verificar que la factura existe y está pagada
        const [facturaRows] = await connection.execute(
            `SELECT id_factura, estado_pedido, fk_id_usuario FROM factura WHERE id_factura = ? AND estado_pedido = 'Pagada'`, [facturaId]
        );
        if (facturaRows.length === 0) throw new Error(`Factura ${facturaId} no encontrada o no está 'Pagada'`);
        if (facturaRows[0].fk_id_usuario !== userId) throw new Error(`Usuario ${userId} no es propietario de factura ${facturaId}`);

        // 2. Obtener items del carrito del usuario
        const [carritoItems] = await connection.execute(`
            SELECT c.FK_referencia_producto, c.FK_id_calcomania, c.cantidad, c.tamano,
                   p.precio_unidad as precio_producto, p.stock as stock_producto,
                   cal.precio_unidad as precio_calcomania_base, cal.stock_pequeno, cal.stock_mediano, cal.stock_grande
            FROM carrito_compras c
            LEFT JOIN producto p ON c.FK_referencia_producto = p.referencia
            LEFT JOIN calcomania cal ON c.FK_id_calcomania = cal.id_calcomania
            WHERE c.FK_id_usuario = ?`, [userId]
        );
        if (carritoItems.length === 0) {
            console.log(`No hay items en el carrito para el usuario ${userId}, la factura ya pudo haber sido procesada.`);
            await connection.commit();
            return { success: true, message: 'No hay items para procesar' };
        }

        // 3. Procesar cada item del carrito
        for (const item of carritoItems) {
            if (item.FK_referencia_producto) {
                if (item.stock_producto < item.cantidad) throw new Error(`Stock insuficiente para producto ${item.FK_referencia_producto}`);
                await connection.execute(`INSERT INTO detalle_factura (FK_id_factura, FK_referencia_producto, cantidad, precio_unidad) VALUES (?, ?, ?, ?)`, [facturaId, item.FK_referencia_producto, item.cantidad, item.precio_producto]);
                await connection.execute(`UPDATE producto SET stock = stock - ? WHERE referencia = ?`, [item.cantidad, item.FK_referencia_producto]);
                console.log(`✅ Producto ${item.FK_referencia_producto}: ${item.cantidad} unidades agregadas, stock reducido`);
            } else if (item.FK_id_calcomania) {
                const tamano = item.tamano || 'mediano';
                let stockDisponible = 0, campoStock = '', precioVenta = item.precio_calcomania_base;
                switch (tamano.toLowerCase()) {
                    case 'pequeño': stockDisponible = item.stock_pequeno; campoStock = 'stock_pequeno'; break;
                    case 'mediano': stockDisponible = item.stock_mediano; campoStock = 'stock_mediano'; precioVenta *= 2.25; break;
                    case 'grande': stockDisponible = item.stock_grande; campoStock = 'stock_grande'; precioVenta *= 4.00; break;
                    default: throw new Error(`Tamaño de calcomanía no válido: ${tamano}`);
                }
                if (stockDisponible < item.cantidad) throw new Error(`Stock insuficiente para calcomanía ${item.FK_id_calcomania} (${tamano})`);
                await connection.execute(`INSERT INTO detalle_factura_calcomania (FK_id_factura, FK_id_calcomania, cantidad, precio_unidad, tamano) VALUES (?, ?, ?, ?, ?)`, [facturaId, item.FK_id_calcomania, item.cantidad, precioVenta, tamano]);
                await connection.execute(`UPDATE calcomania SET ${campoStock} = ${campoStock} - ? WHERE id_calcomania = ?`, [item.cantidad, item.FK_id_calcomania]);
                console.log(`✅ Calcomanía ${item.FK_id_calcomania} (${tamano}): ${item.cantidad} unidades agregadas, stock reducido`);
            }
        }

        // 4. Limpiar carrito y actualizar factura
        const [deleteResult] = await connection.execute(`DELETE FROM carrito_compras WHERE FK_id_usuario = ?`, [userId]);
        console.log(`🗑️ ${deleteResult.affectedRows} items eliminados del carrito`);
        await connection.execute(`UPDATE factura SET fecha_actualizacion = NOW(), estado_pedido = 'Completada' WHERE id_factura = ?`, [facturaId]);

        await connection.commit();
        console.log(`✅ Factura ${facturaId} completada exitosamente en la base de datos.`);

        // 5. Enviar correo de confirmación (DESPUÉS del commit)
        try {
            console.log(`[POST-COMPRA] Recopilando datos para el correo de la factura ${facturaId}`);
            const [facturaData] = await pool.execute(`
                SELECT f.*, u.nombre, u.cedula, u.correo, u.telefono
                FROM factura f JOIN usuario u ON f.fk_id_usuario = u.id_usuario WHERE f.id_factura = ?`, [facturaId]
            );
            const [productosData] = await pool.execute(`SELECT * FROM detalle_factura WHERE FK_id_factura = ?`, [facturaId]);
            const [calcomaniasData] = await pool.execute(`SELECT * FROM detalle_factura_calcomania WHERE FK_id_factura = ?`, [facturaId]);

            if (facturaData.length > 0) {
                const infoFactura = facturaData[0];
                const datosParaEmail = {
                    id_factura: infoFactura.id_factura,
                    fecha_venta: infoFactura.fecha_venta,
                    metodo_pago: infoFactura.metodo_pago || infoFactura.metodo_pago_wompi,
                    valor_total: infoFactura.valor_total,
                    cliente: { nombre: infoFactura.nombre, cedula: infoFactura.cedula, correo: infoFactura.correo, telefono: infoFactura.telefono },
                    productos: productosData,
                    calcomanias: calcomaniasData
                };
                await enviarFacturaOnlinePorCorreo(infoFactura.correo, datosParaEmail);
            }
        } catch (emailError) {
            console.warn(`⚠️ ALERTA: La factura ${facturaId} se completó, pero falló el envío del correo. Error: ${emailError.message}`);
        }

        return { success: true, message: 'Factura completada exitosamente' };
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`❌ Error al completar factura ${facturaId}:`, error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}


/**
 * VERSIÓN CORREGIDA:
 * Elimina las facturas que han superado su tiempo de vida y siguen pendientes.
 * Esta función se ejecuta periódicamente para limpiar el sistema.
 */
async function eliminarFacturasExpiradas() {
    let connection;
    
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        console.log(`[TAREA AUTOMÁTICA] Buscando facturas pendientes expiradas (más de ${TIEMPO_EXPIRACION_MINUTOS} min)...`);

        const [facturasParaEliminar] = await connection.execute(`
            SELECT id_factura, estado_pedido, fecha_venta, fk_id_usuario
            FROM factura 
            WHERE estado_pedido NOT IN ('Pagada', 'Completada') 
              AND fecha_venta < DATE_SUB(NOW(), INTERVAL ? MINUTE)
        `, [TIEMPO_EXPIRACION_MINUTOS]);

        if (facturasParaEliminar.length === 0) {
            console.log('[TAREA AUTOMÁTICA] No se encontraron facturas expiradas para eliminar.');
            await connection.commit();
            return { facturasEliminadas: 0 };
        }

        console.log(`[TAREA AUTOMÁTICA] Se encontraron ${facturasParaEliminar.length} facturas expiradas. Procediendo a eliminar.`);

        const idsFacturas = facturasParaEliminar.map(f => f.id_factura);

        // --- INICIO DE LA CORRECCIÓN ---

        // 1. Generar dinámicamente los marcadores de posición (?) para la cláusula IN.
        // Si idsFacturas es [1, 2, 3], esto creará la cadena "?,?,?"
        const placeholders = idsFacturas.map(() => '?').join(',');

        // 2. Construir las consultas DELETE con los marcadores de posición correctos.
        const sqlDeleteDetalleFactura = `DELETE FROM detalle_factura WHERE FK_id_factura IN (${placeholders})`;
        const sqlDeleteDetalleCalcomania = `DELETE FROM detalle_factura_calcomania WHERE FK_id_factura IN (${placeholders})`;
        const sqlDeleteFactura = `DELETE FROM factura WHERE id_factura IN (${placeholders})`;

        // 3. Ejecutar las consultas pasando el array de IDs directamente.
        // mysql2 ahora asignará cada ID a su propio '?' de forma segura.
        await connection.execute(sqlDeleteDetalleFactura, idsFacturas);
        await connection.execute(sqlDeleteDetalleCalcomania, idsFacturas);
        
        // 4. Eliminar las facturas principales.
        const [deleteResult] = await connection.execute(sqlDeleteFactura, idsFacturas);
        
        // --- FIN DE LA CORRECCIÓN ---
        
        const facturasEliminadas = deleteResult.affectedRows;

        await connection.commit();
        
        console.log(`[TAREA AUTOMÁTICA] ✅ Limpieza completada. Se eliminaron ${facturasEliminadas} facturas.`);
        
        facturasParaEliminar.forEach(factura => {
            console.log(`  -> 🗑️ Factura ${factura.id_factura} (Estado: ${factura.estado_pedido}) creada el ${factura.fecha_venta} ha sido eliminada.`);
        });

        return { facturasEliminadas };

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('❌ [TAREA AUTOMÁTICA] Error durante la limpieza de facturas expiradas:', error);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/**
 * VERSIÓN CORREGIDA:
 * Inicia el proceso automático que verifica periódicamente las facturas expiradas.
 * Esta función debe ser llamada UNA SOLA VEZ cuando tu aplicación se inicia.
 * (Por ejemplo, en tu archivo principal `app.js` o `server.js`).
 */
function iniciarVerificacionDeFacturas() {
    console.log(`🕒 Servicio de verificación de facturas iniciado. Se ejecutará cada ${INTERVALO_VERIFICACION_MS / 1000} segundos.`);
    
    // Ejecuta la función una vez al iniciar, por si había facturas pendientes de un reinicio.
    eliminarFacturasExpiradas().catch(error => {
        console.error('Error en la ejecución inicial de limpieza:', error);
    });
    
    // Configura la ejecución periódica.
    const intervalId = setInterval(() => {
        eliminarFacturasExpiradas().catch(error => {
            // Usamos .catch() para que un error en una ejecución no detenga el intervalo.
            console.error('Error en la ejecución periódica de limpieza:', error);
        });
    }, INTERVALO_VERIFICACION_MS);

    return intervalId; // Devuelve el ID por si necesitas detenerlo en el futuro (ej. para tests).
}

/**
 * Endpoint manual para forzar la limpieza de facturas. Útil para depuración.
 * (Esta función estaba bien, solo la adapto al nuevo nombre de la función de limpieza).
 */
async function forzarLimpiezaFacturas(req, res) {
    try {
        const resultado = await eliminarFacturasExpiradas();
        res.status(200).json({
            success: true,
            message: 'Limpieza manual de facturas completada.',
            ...resultado
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error durante la limpieza manual de facturas.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

module.exports = {
    completarFacturaPagada,       
    eliminarFacturasExpiradas,    
    iniciarVerificacionDeFacturas, 
    forzarLimpiezaFacturas        
};