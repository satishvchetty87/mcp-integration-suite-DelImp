
import { integrationContent } from "../../generated/IntegrationContent";
import { getCurrentDestionation } from "../api_destination"; // Removed .js again

const { integrationPackagesApi } = integrationContent();

export const getPackages = async () => {
	return integrationPackagesApi
		.requestBuilder()
		.getAll()
		.execute(await getCurrentDestionation());
};

export const getPackage = async (id: string) => {
	return integrationPackagesApi
		.requestBuilder()
		.getByKey(id)
		.execute(await getCurrentDestionation());
};

export const createPackage = async (
	id: string,
	name?: string,
	shortText?: string
) => {
	const newPackage = integrationPackagesApi.entityBuilder().fromJson({
		name: name ? name : id,
		id,
		description: shortText ? shortText : "No description",
		shortText: shortText ? shortText : "No description",
	});
	return integrationPackagesApi
		.requestBuilder()
		.create(newPackage)
		.execute(await getCurrentDestionation());
};
