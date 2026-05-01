/**
 * Utility to export an array of objects to a JSON file.
 */
export const exportToJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Utility to read a JSON file and return the parsed data.
 */
export const importFromJSON = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                resolve(data);
            } catch (error) {
                reject(new Error('Archivo JSON inválido.'));
            }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo.'));
        reader.readAsText(file);
    });
};
