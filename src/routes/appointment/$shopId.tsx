import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/appointment/$shopId")({
	component: () => {
		const { shopId } = Route.useParams();
		useEffect(() => { window.location.href = `/biz/${shopId}`; }, []);
		return null;
	},
});
