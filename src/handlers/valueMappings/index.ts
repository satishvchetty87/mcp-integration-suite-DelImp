import { z } from "zod";
import { McpServerWithMiddleware } from "../../utils/middleware";
import { formatError } from "../../utils/customErrHandler";
import { getAllValueMappings, getValueMappingEntries } from "../../api/valueMappings";

export const registerValueMappingHandlers = (server: McpServerWithMiddleware) => {

    server.registerToolIntegrationSuite(
        "get-all-value-mappings",
        `Get a list of all Value Mapping artifacts available in the CPI tenant.
Use this first to find the ID of the Value Mapping you want to inspect.`,
        {},
        async () => {
            try {
                const valueMappings = await getAllValueMappings();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                valueMappings: valueMappings.map(vm => ({
                                    id: vm.id,
                                    name: vm.name,
                                    packageId: vm.packageId,
                                    version: vm.version,
                                    description: vm.description,
                                })),
                            }),
                        },
                    ],
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [formatError(error)],
                };
            }
        }
    );

    server.registerToolIntegrationSuite(
        "get-value-mapping-entries",
        `Get all source/target value pairs from a specific Value Mapping artifact.
Returns a flat table with columns: srcAgency, srcId, tgtAgency, tgtId, srcValue, tgtValue.
Use get-all-value-mappings first to find the correct ID.
If a combination you expect is missing, note the srcAgency, srcId, tgtAgency, tgtId and srcValue - these are needed to add a new entry.`,
        {
            id: z.string().describe("ID of the Value Mapping artifact"),
            version: z.string().optional().describe("Version of the artifact, defaults to active"),
        },
        async ({ id, version }) => {
            try {
                const entries = await getValueMappingEntries(id, version ?? "active");
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                valueMappingId: id,
                                totalEntries: entries.length,
                                entries,
                            }),
                        },
                    ],
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [formatError(error)],
                };
            }
        }
    );
};