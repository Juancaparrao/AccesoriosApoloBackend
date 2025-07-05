const pool = require('../db');
const bcrypt = require('bcrypt');


async function EditarPerfil(req, res) {
    try {
        const id_usuario = req.user.id_usuario; // Asumiendo que req.user.id_usuario viene del middleware de autenticación
        const { nombre, cedula, telefono, contrasena } = req.body;

        if (!nombre || !cedula || !telefono) {
            return res.status(400).json({
                success: false,
                mensaje: 'Los campos nombre, cédula y teléfono son obligatorios.'
            });
        }

        // --- Obtener datos actuales del usuario ---
        const [currentUserRows] = await pool.execute(
            'SELECT cedula, telefono FROM usuario WHERE id_usuario = ?',
            [id_usuario]
        );

        if (currentUserRows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Usuario no encontrado.'
            });
        }

        const currentUser = currentUserRows[0];

        // --- Validación de Cédula ---
        // Solo valida si la cédula cambiara y si el nuevo valor ya existe en otro usuario
        if (cedula !== currentUser.cedula) { // Si la cédula es diferente a la actual del usuario
            const [cedulaExistente] = await pool.execute(
                'SELECT id_usuario FROM usuario WHERE cedula = ?', // No necesitamos 'AND id_usuario != ?' porque ya filtramos
                [cedula]
            );
            if (cedulaExistente.length > 0) {
                return res.status(409).json({
                    success: false,
                    mensaje: 'La cédula ya está registrada por otro usuario.'
                });
            }
        }

        // --- Validación de Teléfono ---
        // Solo valida si el teléfono cambiara y si el nuevo valor ya existe en otro usuario
        if (telefono !== currentUser.telefono) { // Si el teléfono es diferente al actual del usuario
            const [telefonoExistente] = await pool.execute(
                'SELECT id_usuario FROM usuario WHERE telefono = ?', // No necesitamos 'AND id_usuario != ?'
                [telefono]
            );
            if (telefonoExistente.length > 0) {
                return res.status(409).json({
                    success: false,
                    mensaje: 'El teléfono ya está registrado por otro usuario.'
                });
            }
        }

        // Determinar si se debe actualizar la contraseña
        let queryUpdate;
        let parametros;

        if (contrasena && contrasena.trim() !== '') {
            // Si hay contraseña, encriptarla y actualizar todos los campos
            const hashedPassword = await bcrypt.hash(contrasena, 10);
            queryUpdate = 'UPDATE usuario SET nombre = ?, cedula = ?, telefono = ?, contrasena = ? WHERE id_usuario = ?';
            parametros = [nombre, cedula, telefono, hashedPassword, id_usuario];
        } else {
            // Si no hay contraseña, actualizar solo los otros campos
            queryUpdate = 'UPDATE usuario SET nombre = ?, cedula = ?, telefono = ? WHERE id_usuario = ?';
            parametros = [nombre, cedula, telefono, id_usuario];
        }

        // Ejecutar la actualización
        await pool.execute(queryUpdate, parametros);

        return res.status(200).json({
            success: true,
            mensaje: 'Perfil actualizado correctamente.'
        });

    } catch (error) {
        console.error('Error al editar perfil:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error interno al editar el perfil.'
        });
    }
}

module.exports = { EditarPerfil };