import { integrationContent } from "../../generated/IntegrationContent";
import { getCurrentDestination } from "../api_destination";
import { logInfo } from "../..";

const { valueMappingDesigntimeArtifactsApi } = integrationContent();

/**
 * Get all Value Mapping artifacts (basic info only, no entries)
 */
export const getAllValueMappings = async () => {
    return valueMappingDesigntimeArtifactsApi
        .requestBuilder()
        .getAll()
        .execute(await getCurrentDestination());
};

/**
 * Get a single Value Mapping artifact's metadata
 * @param id Value Mapping artifact ID
 * @param version Version, defaults to "active"
 */
export const getValueMapping = async (id: string, version: string = "active") => {
    return valueMappingDesigntimeArtifactsApi
        .requestBuilder()
        .getByKey(id, version)
        .execute(await getCurrentDestination());
};

/**
 * Get all entries (source/target value pairs) for a Value Mapping artifact
 * Walks ValMapSchema -> ValMaps -> Value
 * @param id Value Mapping artifact ID
 * @param version Version, defaults to "active"
 */
export const getValueMappingEntries = async (id: string, version: string = "active") => {
    logInfo(`Getting value mapping entries for ${id} version ${version}`);

    const schemaResult = (
        await valueMappingDesigntimeArtifactsApi
            .requestBuilder()
            .getByKey(id, version)
            .appendPath("/ValMapSchema")
            .executeRaw(await getCurrentDestination())
    ).data.d.results;

    const entries: {
        srcAgency: string;
        srcId: string;
        tgtAgency: string;
        tgtId: string;
        state: string;
        srcValue: string;
        tgtValue: string;
    }[] = [];

    for (const schema of schemaResult) {
        try {
            const valMapsResult = (
                await valueMappingDesigntimeArtifactsApi
                    .requestBuilder()
                    .getByKey(id, version)
                    .appendPath(
                        `/ValMapSchema(SrcAgency='${schema.SrcAgency}',SrcId='${schema.SrcId}',TgtAgency='${schema.TgtAgency}',TgtId='${schema.TgtId}')/ValMaps`
                    )
                    .executeRaw(await getCurrentDestination())
            ).data.d.results;

            for (const valMap of valMapsResult) {
                entries.push({
                    srcAgency: schema.SrcAgency,
                    srcId: schema.SrcId,
                    tgtAgency: schema.TgtAgency,
                    tgtId: schema.TgtId,
                    state: schema.State,
                    srcValue: valMap.Value?.SrcValue ?? "",
                    tgtValue: valMap.Value?.TgtValue ?? "",
                });
            }
        } catch (error) {
            logInfo(`Could not get ValMaps for schema ${schema.SrcAgency}/${schema.SrcId}`);
            logInfo(error);
        }
    }

    logInfo(`Found ${entries.length} value mapping entries for ${id}`);
    return entries;
};