<script lang="ts">
    import type { ZoneDataRow } from "src/types";

    import { getColumns } from "../util/common";

    export let data: ZoneDataRow[] = [];

    $: headers = getColumns(data);
</script>

<table class="table table-light border table-striped">
    <thead>
        <tr>
            {#each headers as header}
                <th scope="col"> {header} </th>
            {/each}
        </tr>
    </thead>

    <tbody>
        {#each data as row}
            <tr>
                {#each headers as header}
                    <td> {row[header]} </td>
                {/each}
            </tr>
        {/each}
    </tbody>
</table>

<style lang="scss" scoped>
    th {
        white-space: nowrap;
    }
    .table {
        table-layout: fixed;
        td {
            text-overflow: ellipsis;
            overflow: hidden;
        }
    }
</style>
