import { Client, isFullPage } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function getProjectCount(): Promise<number> {
  const dataSourceId = process.env.NOTION_DATABASE_ID;
  if (!dataSourceId) throw new Error("NOTION_DATABASE_ID is not set");

  let count = 0;
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      result_type: "page",
      ...(cursor ? { start_cursor: cursor } : {}),
    });

    count += response.results.filter(isFullPage).length;
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return count;
}

export async function getUserCount(): Promise<number> {
  const response = await notion.users.list({ page_size: 100 });
  return response.results.filter((u) => u.type === "person").length;
}
