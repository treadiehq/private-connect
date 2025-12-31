<template>
  <nav class="bg-black/80 backdrop-blur-sm sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-15">
        <!-- Logo -->
        <div class="flex items-center lg:flex-1">
          <NuxtLink to="/" class="text-xl font-semibold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 1 1-.724-1.313l2-1.104ZM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294Zm9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444-.806-.444a.75.75 0 0 1-.295-1.02ZM7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019ZM2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75Zm14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75Zm-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
            </svg>
            <span class="text-base font-semibold text-white">Private Connect</span>
          </NuxtLink>
        </div>

        <div class="flex lg:hidden">
					<button type="button" command="show-modal" commandfor="mobile-menu" class="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700 dark:text-gray-400">
						<span class="sr-only">Open main menu</span>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" data-slot="icon" aria-hidden="true" class="size-6">
							<path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
				</div>

        <div class="hidden lg:flex lg:gap-x-5">
					<!-- <a href="/#pricing" class="text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer hover:bg-gray-500/15 rounded-lg px-3 py-1.5">Pricing</a> -->
					<a href="/#features" class="text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer hover:bg-gray-500/15 rounded-lg px-3 py-1.5">Features</a>
					<a href="/#how-it-works" class="text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer hover:bg-gray-500/15 rounded-lg px-3 py-1.5">How It Works</a>
					<a href="/#security" class="text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer hover:bg-gray-500/15 rounded-lg px-3 py-1.5">Security</a>
				</div>
        
        <!-- Navigation -->
        <nav class="items-center space-x-4 hidden lg:flex lg:flex-1 lg:justify-end">
          <a href="https://github.com/treadiehq/private-connect" class="text-gray-500 hover:text-white transition-colors cursor-pointer" title="GitHub" target="_blank" rel="noopener noreferrer">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"></path>
            </svg>
          </a>
          <NuxtLink to="/login" class="text-sm border font-medium flex items-center gap-2 rounded-lg bg-gray-500/10 border-gray-500/10 text-white hover:bg-gray-500/20 transition-colors py-1.5 px-4">
            <span>Sign In</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
              <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM6.75 9.25a.75.75 0 0 0 0 1.5h4.59l-2.1 1.95a.75.75 0 0 0 1.02 1.1l3.5-3.25a.75.75 0 0 0 0-1.1l-3.5-3.25a.75.75 0 1 0-1.02 1.1l2.1 1.95H6.75Z" clip-rule="evenodd" />
            </svg>
          </NuxtLink>
        </nav>
      </div>
    </div>
    <el-dialog>
			<dialog id="mobile-menu" class="backdrop:bg-transparent lg:hidden">
				<div tabindex="0" class="fixed inset-0 focus:outline-none">
					<el-dialog-panel class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-black p-6 sm:max-w-sm border border-gray-500/20 rounded-lg shadow-xl">
						<div class="flex items-center justify-between">
							<a href="#" class="-m-1.5 p-1.5">
								<span class="sr-only">Private Connect</span>
								<img src="/img/logo.png" alt="Private Connect" class="h-8 w-auto" />
							</a>
							<button type="button" command="close" commandfor="mobile-menu" class="-m-2.5 rounded-md p-2.5 text-gray-400">
								<span class="sr-only">Close menu</span>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" data-slot="icon" aria-hidden="true" class="size-6">
									<path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</button>
						</div>
						<div class="mt-6 flow-root">
							<div class="-my-6 divide-y divide-gray-500/15">
								<div class="space-y-2 py-6">
									<a href="/#features" class="-mx-3 block rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-gray-500/10">Features</a>
									<a href="/#how-it-works" class="-mx-3 block rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-gray-500/10">How It Works</a>
									<a href="/#security" class="-mx-3 block rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-gray-500/10">Security</a>
									<!-- <a href="/#pricing" class="-mx-3 block rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-gray-500/10">Pricing</a> -->
								</div>
								<div class="py-6 flex flex-col gap-2">
									<a href="https://github.com/treadiehq/private-connect" class="-mx-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-gray-500/20" title="GitHub" target="_blank" rel="noopener noreferrer">
										<span>View on Github</span>
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4">
											<path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM6.75 9.25a.75.75 0 0 0 0 1.5h4.59l-2.1 1.95a.75.75 0 0 0 1.02 1.1l3.5-3.25a.75.75 0 0 0 0-1.1l-3.5-3.25a.75.75 0 1 0-1.02 1.1l2.1 1.95H6.75Z" clip-rule="evenodd" />
										</svg>
									</a>
									<NuxtLink to="/login" class="-mx-3 flex border border-gray-500/10 bg-gray-500/10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-gray-500/20">
										Log in
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4">
											<path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM6.75 9.25a.75.75 0 0 0 0 1.5h4.59l-2.1 1.95a.75.75 0 0 0 1.02 1.1l3.5-3.25a.75.75 0 0 0 0-1.1l-3.5-3.25a.75.75 0 1 0-1.02 1.1l2.1 1.95H6.75Z" clip-rule="evenodd" />
										</svg>
									</NuxtLink>
								</div>
							</div>
						</div>
					</el-dialog-panel>
				</div>
			</dialog>
		</el-dialog>
  </nav>
</template>

