export type PublicRepository = {
  owner: string;
  name: string;
  displayName: string;
  url: string;
};

export function parsePublicRepositoryUrl(value: string): PublicRepository {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a full GitHub repository URL.");
  }

  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
    throw new Error("Cartograph currently accepts public github.com repository URLs.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new Error("Use the repository URL, for example https://github.com/owner/repository.");
  }

  const owner = parts[0];
  const name = parts[1].replace(/\.git$/i, "");
  if (!owner || !name) throw new Error("The repository owner and name are required.");

  return {
    owner,
    name,
    displayName: `${owner} / ${name}`,
    url: `https://github.com/${owner}/${name}`,
  };
}
