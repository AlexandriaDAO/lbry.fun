import React from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import LibrarianView from "./LibrarianView";
import NonLibrarianView from "./NonLibrarianView";

function LibrarianCard() {
	const { principal } = useAppSelector(state => state.auth);

	if (!principal) {
		return null;
	}

	return (
		<div className="max-w-md p-3 flex gap-2 flex-col rounded-xl border">
			<div className="flex justify-between items-center">
				<div className="font-syne font-medium text-xl">
					Librarian
				</div>
			</div>
			<div className="flex flex-col gap-4 justify-start items-center">
				{principal === "2vxsx-fae" ? <LibrarianView /> : <NonLibrarianView/>}
			</div>
		</div>
	);
}

export default LibrarianCard;