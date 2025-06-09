export const saveLibrarian = async (alexActor, name) => {
    try {
        await alexActor.save_librarian(name);
        console.log('Librarian saved successfully');
    }
    catch (error) {
        console.error('Error saving librarian:', error);
        throw error;
    }
};
export const deleteLibrarian = async (alexActor) => {
    try {
        await alexActor.delete_librarian();
        console.log('Librarian deleted successfully');
    }
    catch (error) {
        console.error('Error deleting librarian:', error);
        throw error;
    }
};
export const getLibrariansPublic = async (alexActor) => {
    try {
        const result = await alexActor.get_hashes_and_names();
        if (Array.isArray(result) && result.length > 0) {
            return result;
        }
        else {
            return undefined;
        }
    }
    catch (error) {
        console.error('Error retrieving librarian hashes and names:', error);
        throw error;
    }
};
export const getLibrarianByHash = async (alexActor, hashedPrincipal) => {
    try {
        const result = await alexActor.get_librarian(hashedPrincipal);
        console.log("result of getLibrarinByHas()", result);
        if (result && result.length > 0) {
            const librarianData = result[0];
            if ('hashed_principal' in librarianData && 'raw_principal' in librarianData && 'name' in librarianData) {
                const librarian = {
                    hashed_principal: librarianData.hashed_principal,
                    raw_principal: librarianData.raw_principal,
                    name: librarianData.name,
                };
                return librarian;
            }
        }
        return undefined;
    }
    catch (error) {
        console.error('Error retrieving librarian:', error);
        throw error;
    }
};
export const isLibrarian = async (alexActor) => {
    try {
        const librarian = await alexActor.is_librarian();
        console.log("IsLibrarian?: ", librarian);
        return librarian;
    }
    catch (error) {
        console.error('Error checking librarian status:', error);
        throw error;
    }
};
