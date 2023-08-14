import { createQuery } from '../../lib/query';
import type { GithubRepo, Project, ProjectCollection } from '../../lib/types/types';
import { getAllCategories, getProjectsFromAwesomeList } from '../../lib/repositories';
import { fetchRepoInfoFromGithub } from '../../lib/fetch-github';
import { dev } from '$app/environment';
import {
	chunkSize,
	extractGithubRepoUrls,
	mapProjectToRepo,
	removeTrailingSlashes
} from '../../lib';

export async function entries(): Promise<Array<{ category: string }>> {
	console.log('creating entries function');
	const { urls } = await getAllCategories();
	return [{ category: '' }].concat([...urls].map((url) => ({ category: url.slice(1) })));
}

let allProjects: Project[] = [];
let loaded = false;

export async function load({ params }): Promise<ProjectCollection> {
	const requestedCategory: string = removeTrailingSlashes(params.category) ?? '';
	console.log('creating load function, category: ', requestedCategory);
	if (allProjects.length === 0) {
		allProjects = await getProjectsFromAwesomeList();
	}
	const githubRepoUrls = extractGithubRepoUrls(allProjects);

	let data: GithubRepo[] = [];
	if (!loaded) {
		for (let i = 0; i < githubRepoUrls.size; i += chunkSize) {
			const start = performance.now();

			const chunk = [...githubRepoUrls].slice(i, i + chunkSize);
			const query = await createQuery(chunk);
			const result = await fetchRepoInfoFromGithub(query);
			data = data.concat(result);
			const end = performance.now();
			console.log(`fetched ${result.length} repositories from Github in ${end - start}ms`);

			if (dev) {
				break; // in development its faster to only do one fetch
			}
		}

		allProjects.map((project) => mapProjectToRepo(data, project));

		loaded = true;
	}

	let filteredProjects: Project[] = allProjects;
	if (requestedCategory !== '') {
		filteredProjects = filteredProjects.filter((project) => {
			if (!project.category) {
				return false;
			}
			return project.category.includes(requestedCategory);
		});
	}

	const sortedProjects = filteredProjects.sort((a, b) => {
		const starsA = a.stars || 0;
		const starsB = b.stars || 0;
		return starsB - starsA;
	});

	return {
		projects: sortedProjects,
		categories: await getAllCategories()
	};
}
