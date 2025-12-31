<template>
  <footer class="border-t border-gray-500/10 mt-8">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="border-t border-transparent flex flex-col md:flex-row items-center justify-between py-6">
				<div class="flex items-center justify-center gap-3 relative">
					<p class="text-xs leading-6 font-medium text-gray-500 xl:text-center">
						&copy; {{new Date().getFullYear()}} Treadie, Inc.
					</p>
					<span class="text-gray-500/50 text-xs">|</span>
					<div
					class="flex space-x-6 items-center md:mt-0 mt-4"
				>
					<NuxtLink
						to="/terms"
						class="text-xs font-semibold leading-6 hover:text-blue-300 text-gray-500"
					>
						Terms
					</NuxtLink>
					<NuxtLink
						to="/privacy"
						class="text-xs font-semibold leading-6 hover:text-blue-300 text-gray-500"
					>
						Privacy
					</NuxtLink>
					<a
						href="/#security"
						class="text-xs font-semibold leading-6 hover:text-blue-300 text-gray-500"
					>
						Security
					</a>
				</div>
				</div>
				<div
					class="flex space-x-6 items-center md:mt-0 mt-4"
				>
					<a
						href="https://discord.gg/KqdBcqRk5E"
						target="_blank"
						class="text-sm font-semibold leading-6 hover:text-blue-300 text-gray-500"
					>
						<svg viewBox="0 0 20 20" aria-hidden="true" class="h-5 w-5" fill="currentColor">
							<path d="M16.238 4.515a14.842 14.842 0 0 0-3.664-1.136.055.055 0 0 0-.059.027 10.35 10.35 0 0 0-.456.938 13.702 13.702 0 0 0-4.115 0 9.479 9.479 0 0 0-.464-.938.058.058 0 0 0-.058-.027c-1.266.218-2.497.6-3.664 1.136a.052.052 0 0 0-.024.02C1.4 8.023.76 11.424 1.074 14.782a.062.062 0 0 0 .024.042 14.923 14.923 0 0 0 4.494 2.272.058.058 0 0 0 .064-.02c.346-.473.654-.972.92-1.496a.057.057 0 0 0-.032-.08 9.83 9.83 0 0 1-1.404-.669.058.058 0 0 1-.029-.046.058.058 0 0 1 .023-.05c.094-.07.189-.144.279-.218a.056.056 0 0 1 .058-.008c2.946 1.345 6.135 1.345 9.046 0a.056.056 0 0 1 .059.007c.09.074.184.149.28.22a.058.058 0 0 1 .023.049.059.059 0 0 1-.028.046 9.224 9.224 0 0 1-1.405.669.058.058 0 0 0-.033.033.056.056 0 0 0 .002.047c.27.523.58 1.022.92 1.495a.056.056 0 0 0 .062.021 14.878 14.878 0 0 0 4.502-2.272.055.055 0 0 0 .016-.018.056.056 0 0 0 .008-.023c.375-3.883-.63-7.256-2.662-10.246a.046.046 0 0 0-.023-.021Zm-9.223 8.221c-.887 0-1.618-.814-1.618-1.814s.717-1.814 1.618-1.814c.908 0 1.632.821 1.618 1.814 0 1-.717 1.814-1.618 1.814Zm5.981 0c-.887 0-1.618-.814-1.618-1.814s.717-1.814 1.618-1.814c.908 0 1.632.821 1.618 1.814 0 1-.71 1.814-1.618 1.814Z"></path>
						</svg>
					</a>
					<a
						href="https://github.com/treadiehq/airatelimit"
						target="_blank"
						class="text-sm font-semibold leading-6 hover:text-blue-300 text-gray-500"
					>
						<svg
							aria-label="github"
							viewBox="0 0 14 14"
							class="h-4 w-4"
							fill="currentColor"
						>
							<path
								d="M7 .175c-3.872 0-7 3.128-7 7 0 3.084 2.013 5.71 4.79 6.65.35.066.482-.153.482-.328v-1.181c-1.947.415-2.363-.941-2.363-.941-.328-.81-.787-1.028-.787-1.028-.634-.438.044-.416.044-.416.7.044 1.071.722 1.071.722.635 1.072 1.641.766 2.035.59.066-.459.24-.765.437-.94-1.553-.175-3.193-.787-3.193-3.456 0-.766.262-1.378.721-1.881-.065-.175-.306-.897.066-1.86 0 0 .59-.197 1.925.722a6.754 6.754 0 0 1 1.75-.24c.59 0 1.203.087 1.75.24 1.335-.897 1.925-.722 1.925-.722.372.963.131 1.685.066 1.86.46.48.722 1.115.722 1.88 0 2.691-1.641 3.282-3.194 3.457.24.219.481.634.481 1.29v1.926c0 .197.131.415.481.328C11.988 12.884 14 10.259 14 7.175c0-3.872-3.128-7-7-7z"
								fill="currentColor"
								fill-rule="evenodd"
							></path>
						</svg>
					</a>
					<a
						href="https://twitter.com/treadieinc"
						target="_blank"
						class="hover:text-blue-300 text-gray-500"
					>
						<span class="sr-only">X formerly known as Twitter</span>
						<svg aria-label="X formerly known as Twitter" fill="currentColor" class="h-4 w-4" viewBox="0 0 22 20"><path d="M16.99 0H20.298L13.071 8.26L21.573 19.5H14.916L9.702 12.683L3.736 19.5H0.426L8.156 10.665L0 0H6.826L11.539 6.231L16.99 0ZM15.829 17.52H17.662L5.83 1.876H3.863L15.829 17.52Z" class="astro-3SDC4Q5U"></path></svg>
					</a>
				</div>
			</div>
    </div>
  </footer>
</template>

