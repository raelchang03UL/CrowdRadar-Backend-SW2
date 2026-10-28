import { DataTypes } from 'sequelize';

export async function assertFavoritesSchemaReady(sequelize) {
    const queryInterface = sequelize.getQueryInterface();
    
    // Crear tabla lugar_favorito si no existe
    await queryInterface.createTable('lugar_favorito', {
        id_usuario: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
                model: 'users',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        id_lugar: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
                model: 'places',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        creado_en: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
    }).catch(() => {
        // La tabla ya existe
    });
}